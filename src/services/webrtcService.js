import { getFirebaseClients } from '../firebase/config';
import { debugLog } from '../utils/devLogger';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CONNECTION_TIMEOUT_MS = 12000;
const MAX_ICE_RESTART_ATTEMPTS = 2;

function buildConfig(iceServers) {
  return {
    iceServers: Array.isArray(iceServers) && iceServers.length ? iceServers : DEFAULT_ICE_SERVERS,
    iceCandidatePoolSize: 4,
  };
}

function getCandidateType(candidateText = '') {
  const match = candidateText.match(/\btyp\s([a-z]+)/i);
  return match?.[1]?.toLowerCase() || 'unknown';
}

async function logSelectedPair(pc) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;
    stats.forEach((report) => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
      }
      if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
        selectedPair = selectedPair || report;
      }
    });

    if (!selectedPair) {
      debugLog('webrtcService', 'Connected, but selected ICE pair is unavailable.');
      return;
    }

    const local = stats.get(selectedPair.localCandidateId);
    const remote = stats.get(selectedPair.remoteCandidateId);
    const relayUsed = local?.candidateType === 'relay' || remote?.candidateType === 'relay';

    debugLog('webrtcService', 'Selected ICE candidate pair.', {
      relayUsed,
      localType: local?.candidateType || null,
      remoteType: remote?.candidateType || null,
      localProtocol: local?.protocol || null,
      remoteProtocol: remote?.protocol || null,
    });
  } catch (error) {
    debugLog('webrtcService', 'Failed to inspect selected ICE candidate pair.', { message: error.message });
  }
}

async function addCandidate(addDoc, candidateCollectionRef, candidate) {
  await addDoc(candidateCollectionRef, {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment || null,
    createdAt: Date.now(),
  });
}

function hydrateCandidate(data) {
  return new RTCIceCandidate({
    candidate: data.candidate,
    sdpMid: data.sdpMid,
    sdpMLineIndex: data.sdpMLineIndex,
    usernameFragment: data.usernameFragment || undefined,
  });
}

async function clearCandidateCollection(getDocs, deleteDoc, collectionRef) {
  const snapshot = await getDocs(collectionRef);
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
}

export async function createWebRtcSessionController({
  sessionId,
  role,
  currentUserId,
  iceServers,
  onRemoteStream,
  onRemoteScreenStream,
  onLocalStream,
  onConnectionMessage,
  onNetworkFailure,
  onSessionState,
  onScreenShareStateChange,
}) {
  const clients = await getFirebaseClients();
  if (!clients) {
    throw new Error('Realtime calls require Firebase configuration.');
  }

  const { db, firestoreModule } = clients;
  const {
    doc,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    getDoc,
    onSnapshot,
    setDoc,
  } = firestoreModule;

  const sessionRef = doc(db, 'sessions', sessionId);
  const tutorCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcTutorCandidates');
  const studentCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcStudentCandidates');
  const restartCollectionRef = collection(db, 'sessions', sessionId, 'webrtcRestartRequests');

  const resolvedConfig = buildConfig(iceServers);
  const resolvedIceUrls = resolvedConfig.iceServers.flatMap((entry) => {
    if (!entry?.urls) return [];
    return Array.isArray(entry.urls) ? entry.urls : [entry.urls];
  });
  debugLog('webrtcService', 'Creating RTCPeerConnection with ICE servers.', {
    urls: resolvedIceUrls,
  });
  const discoveredCandidateTypes = new Set();
  const pc = new RTCPeerConnection(resolvedConfig);

  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  onLocalStream?.(localStream);

  const audioTrack = localStream.getAudioTracks()[0] || null;
  const cameraTrack = localStream.getVideoTracks()[0] || null;

  if (audioTrack) {
    pc.addTrack(audioTrack, localStream);
  }

  let cameraSender = null;
  if (cameraTrack) {
    cameraSender = pc.addTrack(cameraTrack, localStream);
  }

  /**
   * IMPORTANT:
   * We pre-create a dedicated second video transceiver for screen share.
   * This allows camera + screen share to exist separately.
   */
  const screenTransceiver = pc.addTransceiver('video', {
    direction: role === 'tutor' ? 'sendrecv' : 'recvonly',
  });

  const remoteCameraStream = new MediaStream();
  const remoteScreenStream = new MediaStream();

  let reconnectAttempts = 0;
  let isClosed = false;
  let connectTimer = null;
  let activeScreenStream = null;
  let activeScreenTrack = null;
  let latestOfferRevision = 0;
  let isLocalScreenSharing = false;
  let isRemoteScreenSharing = false;
  const unsubscribers = [];

  const setConnectionTimeout = () => {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      if (pc.connectionState === 'connected') return;
      onNetworkFailure?.('Your network is blocking the connection. Please retry or switch network.');
    }, CONNECTION_TIMEOUT_MS);
  };

  const emitScreenShareState = () => {
    onScreenShareStateChange?.({
      local: isLocalScreenSharing,
      remote: isRemoteScreenSharing,
    });
  };

  const updateScreenShareDocState = async (active) => {
    const sessionSnap = await getDoc(sessionRef);
    const existing = sessionSnap.data()?.webrtc || {};

    await setDoc(
      sessionRef,
      {
        webrtc: {
          ...existing,
          screenShare: {
            active,
            by: active ? role : null,
            updatedAt: Date.now(),
          },
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  };

  pc.ontrack = (event) => {
    const incomingTrack = event.track;
    const incomingMid = event.transceiver?.mid;
    const screenMid = screenTransceiver?.mid;

    if (incomingTrack.kind !== 'video' && incomingTrack.kind !== 'audio') return;

    /**
     * Remote screen share track
     */
    if (incomingTrack.kind === 'video' && screenMid && incomingMid === screenMid) {
      remoteScreenStream.getTracks().forEach((track) => remoteScreenStream.removeTrack(track));
      remoteScreenStream.addTrack(incomingTrack);
      isRemoteScreenSharing = true;
      onRemoteScreenStream?.(remoteScreenStream);
      emitScreenShareState();

      incomingTrack.addEventListener('ended', () => {
        remoteScreenStream.getTracks().forEach((track) => remoteScreenStream.removeTrack(track));
        isRemoteScreenSharing = false;
        onRemoteScreenStream?.(null);
        emitScreenShareState();
      });

      return;
    }

    /**
     * Regular remote audio/video stream
     */
    const alreadyExists = remoteCameraStream.getTracks().some((track) => track.id === incomingTrack.id);
    if (!alreadyExists) {
      remoteCameraStream.addTrack(incomingTrack);
      onRemoteStream?.(remoteCameraStream);
    }

    incomingTrack.addEventListener('ended', () => {
      remoteCameraStream.getTracks().forEach((track) => {
        if (track.readyState === 'ended') {
          remoteCameraStream.removeTrack(track);
        }
      });
      onRemoteStream?.(remoteCameraStream);
    });
  };

  pc.onicecandidate = async (event) => {
    if (!event.candidate) return;
    const type = getCandidateType(event.candidate.candidate);
    discoveredCandidateTypes.add(type);
    debugLog('webrtcService', 'Local ICE candidate discovered.', {
      type,
      protocol: event.candidate.protocol || null,
      discoveredTypes: Array.from(discoveredCandidateTypes),
    });
    const destination = role === 'tutor' ? tutorCandidatesRef : studentCandidatesRef;
    await addCandidate(addDoc, destination, event.candidate);
  };

  pc.onconnectionstatechange = () => {
    onSessionState?.(pc.connectionState);
    debugLog('webrtcService', 'connectionState changed.', { state: pc.connectionState });

    if (pc.connectionState === 'connected') {
      onConnectionMessage?.('Connected');
      logSelectedPair(pc);
      if (connectTimer) clearTimeout(connectTimer);
      return;
    }

    if (['failed', 'disconnected'].includes(pc.connectionState)) {
      onConnectionMessage?.('Reconnecting…');
    }
  };

  pc.oniceconnectionstatechange = async () => {
    debugLog('webrtcService', 'iceConnectionState changed.', { state: pc.iceConnectionState });
    if (!['failed', 'disconnected'].includes(pc.iceConnectionState)) return;

    if (reconnectAttempts >= MAX_ICE_RESTART_ATTEMPTS) {
      onNetworkFailure?.('Your network is blocking the connection. Please retry or switch network.');
      return;
    }

    reconnectAttempts += 1;

    if (role === 'tutor') {
      const sessionSnap = await getDoc(sessionRef);
      const revision = Number(sessionSnap.data()?.webrtc?.offerRevision || 0) + 1;

      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);

      await clearCandidateCollection(getDocs, deleteDoc, tutorCandidatesRef);
      await clearCandidateCollection(getDocs, deleteDoc, studentCandidatesRef);

      await setDoc(
        sessionRef,
        {
          webrtc: {
            ...(sessionSnap.data()?.webrtc || {}),
            offer: offer.toJSON(),
            answer: null,
            offerRevision: revision,
            lastRestartAt: Date.now(),
            status: 'restarting',
          },
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      await addDoc(restartCollectionRef, {
        requestedBy: currentUserId,
        createdAt: Date.now(),
        revision,
      });

      latestOfferRevision = revision;
      setConnectionTimeout();
    }
  };

  const otherCandidateCollection = role === 'tutor' ? studentCandidatesRef : tutorCandidatesRef;

  unsubscribers.push(
    onSnapshot(otherCandidateCollection, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;
        try {
          const candidate = hydrateCandidate(change.doc.data());
          const type = getCandidateType(candidate.candidate);
          discoveredCandidateTypes.add(type);
          debugLog('webrtcService', 'Remote ICE candidate received.', {
            type,
            discoveredTypes: Array.from(discoveredCandidateTypes),
          });
          await pc.addIceCandidate(candidate);
        } catch (_) {
          // Ignore stale ICE candidate errors during reconnect.
        }
      });
    }),
  );

  unsubscribers.push(
    onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data() || {};
      const webrtc = data.webrtc || {};

      if (typeof webrtc?.screenShare?.active === 'boolean') {
        isRemoteScreenSharing = role === 'student' ? Boolean(webrtc.screenShare.active) : isRemoteScreenSharing;
        emitScreenShareState();

        if (!webrtc.screenShare.active) {
          onRemoteScreenStream?.(null);
        }
      }

      if (role === 'tutor') {
        if (webrtc.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(webrtc.answer));
          await setDoc(
            sessionRef,
            { webrtc: { ...webrtc, status: 'connected' }, updatedAt: Date.now() },
            { merge: true },
          );
        }
        return;
      }

      const offerRevision = Number(webrtc.offerRevision || 0);
      if (!webrtc.offer) return;

      const shouldHandleOffer = !pc.currentRemoteDescription || offerRevision > latestOfferRevision;
      if (!shouldHandleOffer) return;

      latestOfferRevision = offerRevision;

      await pc.setRemoteDescription(new RTCSessionDescription(webrtc.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setDoc(
        sessionRef,
        {
          webrtc: {
            ...webrtc,
            answer: answer.toJSON(),
            studentReadyAt: Date.now(),
            status: 'connecting',
          },
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      setConnectionTimeout();
    }),
  );

  if (role === 'tutor') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await clearCandidateCollection(getDocs, deleteDoc, tutorCandidatesRef);
    await clearCandidateCollection(getDocs, deleteDoc, studentCandidatesRef);

    await setDoc(
      sessionRef,
      {
        webrtc: {
          ready: true,
          status: 'tutor_waiting',
          offer: offer.toJSON(),
          answer: null,
          offerRevision: 1,
          tutorReadyAt: Date.now(),
          studentReadyAt: null,
          lastRestartAt: null,
          screenShare: {
            active: false,
            by: null,
            updatedAt: null,
          },
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    latestOfferRevision = 1;
  } else {
    await setDoc(
      sessionRef,
      {
        webrtc: {
          status: 'student_joining',
          studentReadyAt: Date.now(),
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    setConnectionTimeout();
  }

  const switchCameraTrack = async (nextTrack) => {
    if (!cameraSender) return;
    await cameraSender.replaceTrack(nextTrack);
  };

  const switchScreenTrack = async (nextTrack) => {
    if (!screenTransceiver?.sender) return;
    await screenTransceiver.sender.replaceTrack(nextTrack);
  };

  const stopScreenShare = async () => {
    if (!activeScreenStream) return;

    activeScreenStream.getTracks().forEach((track) => track.stop());
    activeScreenStream = null;
    activeScreenTrack = null;

    await switchScreenTrack(null);

    isLocalScreenSharing = false;
    emitScreenShareState();
    await updateScreenShareDocState(false);
    onConnectionMessage?.('Screen sharing ended');
  };

  const startScreenShare = async () => {
    if (role !== 'tutor') {
      throw new Error('Only tutors can share screen.');
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) {
      screenStream.getTracks().forEach((track) => track.stop());
      throw new Error('No screen track available.');
    }

    activeScreenStream = screenStream;
    activeScreenTrack = screenTrack;

    await switchScreenTrack(screenTrack);

    isLocalScreenSharing = true;
    emitScreenShareState();
    await updateScreenShareDocState(true);
    onConnectionMessage?.('Screen sharing started');

    screenTrack.addEventListener('ended', async () => {
      await stopScreenShare();
    });
  };

  const toggleAudio = () => {
    const track = localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  };

  const toggleVideo = () => {
    const track = localStream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  };

  const close = async () => {
    if (isClosed) return;
    isClosed = true;

    if (connectTimer) clearTimeout(connectTimer);

    unsubscribers.forEach((unsub) => unsub());

    if (activeScreenStream) {
      activeScreenStream.getTracks().forEach((track) => track.stop());
    }

    localStream.getTracks().forEach((track) => track.stop());

    pc.getSenders().forEach((sender) => {
      // Avoid stopping shared underlying local tracks twice if already handled,
      // but this is still safe enough in practice.
      sender.track?.stop?.();
    });

    pc.close();
  };

  return {
    localStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    close,
  };
}

export function getDefaultIceServers() {
  return DEFAULT_ICE_SERVERS;
}
