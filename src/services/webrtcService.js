import { getFirebaseClients } from '../firebase/config';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CONNECTION_TIMEOUT_MS = 12000;
const MAX_ICE_RESTART_ATTEMPTS = 2;

function buildConfig() {
  return {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 4,
  };
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
  onRemoteStream,
  onLocalStream,
  onConnectionMessage,
  onNetworkFailure,
  onSessionState,
}) {
  const clients = await getFirebaseClients();
  if (!clients) {
    throw new Error('Realtime calls require Firebase configuration.');
  }

  const { db, firestoreModule } = clients;
  const { doc, collection, addDoc, getDocs, deleteDoc, getDoc, onSnapshot, setDoc } = firestoreModule;
  const sessionRef = doc(db, 'sessions', sessionId);
  const tutorCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcTutorCandidates');
  const studentCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcStudentCandidates');
  const restartCollectionRef = collection(db, 'sessions', sessionId, 'webrtcRestartRequests');

  const pc = new RTCPeerConnection(buildConfig());
  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  onLocalStream?.(localStream);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const remoteStream = new MediaStream();
  let reconnectAttempts = 0;
  let isClosed = false;
  let connectTimer = null;
  let activeScreenStream = null;
  let latestOfferRevision = 0;
  const unsubscribers = [];

  const setConnectionTimeout = () => {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      if (pc.connectionState === 'connected') return;
      onNetworkFailure?.('Your network is blocking the connection. Please retry or switch network.');
    }, CONNECTION_TIMEOUT_MS);
  };

  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
    onRemoteStream?.(remoteStream);
  };

  pc.onicecandidate = async (event) => {
    if (!event.candidate) return;
    const destination = role === 'tutor' ? tutorCandidatesRef : studentCandidatesRef;
    await addCandidate(addDoc, destination, event.candidate);
  };

  pc.onconnectionstatechange = () => {
    onSessionState?.(pc.connectionState);
    if (pc.connectionState === 'connected') {
      onConnectionMessage?.('Connected');
      if (connectTimer) clearTimeout(connectTimer);
      return;
    }
    if (['failed', 'disconnected'].includes(pc.connectionState)) {
      onConnectionMessage?.('Reconnecting…');
    }
  };

  pc.oniceconnectionstatechange = async () => {
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
      await setDoc(sessionRef, {
        webrtc: {
          ...(sessionSnap.data()?.webrtc || {}),
          offer: offer.toJSON(),
          answer: null,
          offerRevision: revision,
          lastRestartAt: Date.now(),
          status: 'restarting',
        },
        updatedAt: Date.now(),
      }, { merge: true });
      await addDoc(restartCollectionRef, { requestedBy: currentUserId, createdAt: Date.now(), revision });
      latestOfferRevision = revision;
      setConnectionTimeout();
    }
  };

  const otherCandidateCollection = role === 'tutor' ? studentCandidatesRef : tutorCandidatesRef;
  unsubscribers.push(onSnapshot(otherCandidateCollection, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type !== 'added') return;
      try {
        await pc.addIceCandidate(hydrateCandidate(change.doc.data()));
      } catch (_) {
        // Ignore stale ICE candidate errors during reconnect.
      }
    });
  }));

  unsubscribers.push(onSnapshot(sessionRef, async (snapshot) => {
    const data = snapshot.data() || {};
    const webrtc = data.webrtc || {};

    if (role === 'tutor') {
      if (webrtc.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(webrtc.answer));
        await setDoc(sessionRef, { webrtc: { ...webrtc, status: 'connected' }, updatedAt: Date.now() }, { merge: true });
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
    await setDoc(sessionRef, {
      webrtc: {
        ...webrtc,
        answer: answer.toJSON(),
        studentReadyAt: Date.now(),
        status: 'connecting',
      },
      updatedAt: Date.now(),
    }, { merge: true });
    setConnectionTimeout();
  }));

  if (role === 'tutor') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await clearCandidateCollection(getDocs, deleteDoc, tutorCandidatesRef);
    await clearCandidateCollection(getDocs, deleteDoc, studentCandidatesRef);
    await setDoc(sessionRef, {
      webrtc: {
        ready: true,
        status: 'tutor_waiting',
        offer: offer.toJSON(),
        answer: null,
        offerRevision: 1,
        tutorReadyAt: Date.now(),
        studentReadyAt: null,
        lastRestartAt: null,
      },
      updatedAt: Date.now(),
    }, { merge: true });
    latestOfferRevision = 1;
  } else {
    await setDoc(sessionRef, {
      webrtc: {
        status: 'student_joining',
        studentReadyAt: Date.now(),
      },
      updatedAt: Date.now(),
    }, { merge: true });
    setConnectionTimeout();
  }

  const switchVideoTrack = async (nextTrack) => {
    const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(nextTrack);
    }
  };

  const startScreenShare = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = screenStream.getVideoTracks()[0];
    const cameraTrack = localStream.getVideoTracks()[0];

    if (!screenTrack) return;
    await switchVideoTrack(screenTrack);

    screenTrack.addEventListener('ended', async () => {
      if (cameraTrack) {
        await switchVideoTrack(cameraTrack);
      }
      activeScreenStream?.getTracks().forEach((track) => track.stop());
      activeScreenStream = null;
      onConnectionMessage?.('Screen sharing ended');
    });

    activeScreenStream = screenStream;
    onConnectionMessage?.('Screen sharing started');
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
    activeScreenStream?.getTracks().forEach((track) => track.stop());
    localStream.getTracks().forEach((track) => track.stop());
    pc.getSenders().forEach((sender) => sender.track?.stop());
    pc.close();
  };

  return {
    localStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    close,
  };
}

export function getDefaultIceServers() {
  return ICE_SERVERS;
}
