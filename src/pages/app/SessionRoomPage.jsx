import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeDollarSign,
  Clock3,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Presentation,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import ExcalidrawEmbed from '../../components/app/ExcalidrawEmbed';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { SESSION_STATUS } from '../../constants/lifecycle';
import { BILLING_RULES } from '../../utils/onboarding';
import {
  endSession,
  joinSessionAsStudent,
  submitSessionRating,
  updateSession,
} from '../../services/sessionService';
import { createWebRtcSessionController } from '../../services/webrtcService';
import { fetchIceServers } from '../../services/iceServerService';
import { debugLog } from '../../utils/devLogger';
import { updateClassRequest } from '../../services/classRequestService';
import { REQUEST_STATUSES } from '../../utils/requestStatus';

function useLiveSeconds(startTs) {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTs) return 0;
  return Math.max(0, Math.floor((tick - startTs) / 1000));
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mins}:${secs}`;
  }

  return `${mins}:${secs}`;
}

function StageBadge({ icon: Icon, children, tone = 'default', className = '' }) {
  const toneClasses = {
    default: 'border-white/10 bg-[#1f2430]/96 text-zinc-100',
    info: 'border-sky-500/25 bg-sky-500/14 text-sky-200',
    success: 'border-emerald-500/25 bg-emerald-500/14 text-emerald-200',
    warning: 'border-amber-500/25 bg-amber-500/14 text-amber-200',
    danger: 'border-rose-500/25 bg-rose-500/14 text-rose-200',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-md backdrop-blur ${toneClasses[tone]} ${className}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </div>
  );
}

function RailButton({
  onClick,
  icon: Icon,
  label,
  danger = false,
  disabled = false,
  active = false,
  compact = false,
}) {
  const classes = danger
    ? 'border-rose-500/20 bg-rose-500 text-white hover:bg-rose-600'
    : active
      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20'
      : 'border-white/10 bg-[#1f2430]/95 text-zinc-100 hover:bg-[#272d3a]';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
        compact ? 'h-10 w-10 md:h-12 md:w-12' : 'h-12 w-12'
      } ${classes}`}
    >
      <Icon className={compact ? 'h-4 w-4 md:h-4.5 md:w-4.5' : 'h-4.5 w-4.5'} />
    </button>
  );
}

function HiddenMediaMounts({ localVideoRef, remoteVideoRef, remoteScreenVideoRef }) {
  return (
    <div className="pointer-events-none absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden opacity-0">
      <video ref={localVideoRef} autoPlay playsInline muted />
      <video ref={remoteVideoRef} autoPlay playsInline />
      {remoteScreenVideoRef ? <video ref={remoteScreenVideoRef} autoPlay playsInline /> : null}
    </div>
  );
}

export default function SessionRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(user?.uid);
  const { sessions: tutorSessions } = useTutorSessions(user?.uid);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const session = sessions.find((item) => item.id === id);

  const [ratingForm, setRatingForm] = useState({ overall: '5', topic: '5', comment: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCardId] = useState(
    user?.paymentMethods?.find((card) => card.isDefault)?.id
      || user?.paymentMethods?.[0]?.id
      || '',
  );
  const [isBusy, setIsBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [remoteScreenStreamObj, setRemoteScreenStreamObj] = useState(null);
  const [showStudentControls, setShowStudentControls] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);

  const rtcRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const connectionStartRecordedRef = useRef(false);
  const activeInitKeyRef = useRef('');
  const rtcInitStartedRef = useRef(false);
  const hadSessionRef = useRef(false);
  const studentControlsTimeoutRef = useRef(null);

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const needsRating = session?.status === SESSION_STATUS.COMPLETED && !session?.ratings?.[role];
  const forceRelayOnly = String(import.meta.env.VITE_WEBRTC_FORCE_RELAY_ONLY || '').toLowerCase() === 'true';
  const whiteboardRoom = session?.whiteboardRoomId || session?.requestId || session?.id;
  const graceRemaining = Math.max(0, Math.ceil(((session?.joinGraceEndsAt || 0) - Date.now()) / 1000));

  const connectionTone = useMemo(() => {
    if (networkError) return 'danger';
    if (!connectionMessage) return 'default';
    if (
      connectionMessage.toLowerCase().includes('connected')
      || connectionMessage.toLowerCase().includes('live')
    ) {
      return 'success';
    }
    return 'info';
  }, [connectionMessage, networkError]);

  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
    }
  }, [session]);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
    connectionStartRecordedRef.current = false;
    activeInitKeyRef.current = '';
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(true);
  }, [session?.id, role]);

  useEffect(() => {
    return () => {
      rtcRef.current?.close?.();
      rtcRef.current = null;
      rtcInitStartedRef.current = false;
      setRemoteScreenStreamObj(null);
      if (studentControlsTimeoutRef.current) {
        clearTimeout(studentControlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!remoteScreenVideoRef.current) return;
    remoteScreenVideoRef.current.srcObject = remoteScreenStreamObj || null;

    debugLog('sessionRoom', 'Attached remote screen stream to student video element.', {
      hasStream: Boolean(remoteScreenStreamObj),
    });
  }, [remoteScreenStreamObj, isRemoteScreenSharing]);

  useEffect(() => {
    const updateViewportFlags = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setIsMobileViewport(isMobile);
      setIsPortraitMobile(isMobile && isPortrait);
    };

    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);

    const media = window.matchMedia('(orientation: portrait)');
    const onOrientationChange = () => updateViewportFlags();

    if (media.addEventListener) {
      media.addEventListener('change', onOrientationChange);
    } else {
      media.addListener(onOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', updateViewportFlags);
      if (media.removeEventListener) {
        media.removeEventListener('change', onOrientationChange);
      } else {
        media.removeListener(onOrientationChange);
      }
    };
  }, []);

  useEffect(() => {
    async function tryLockLandscape() {
      if (!isMobileViewport) return;
      try {
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock('landscape');
        }
      } catch {
        // Some browsers ignore or reject this.
      }
    }

    tryLockLandscape();
  }, [isMobileViewport]);

  useEffect(() => {
    if (role !== 'student') return;
    if (!showStudentControls) return;

    if (studentControlsTimeoutRef.current) {
      clearTimeout(studentControlsTimeoutRef.current);
    }

    studentControlsTimeoutRef.current = setTimeout(() => {
      setShowStudentControls(false);
    }, 5000);

    return () => {
      if (studentControlsTimeoutRef.current) {
        clearTimeout(studentControlsTimeoutRef.current);
      }
    };
  }, [role, showStudentControls]);

  const initializeCall = useCallback(async ({ shouldJoinStudent }) => {
    if (!session || !user?.uid) return;

    const initKey = `${session.id}:${role}`;

    if (rtcRef.current) {
      debugLog('sessionRoom', 'Skipping init because rtcRef already exists.', { initKey });
      return;
    }
    if (rtcInitStartedRef.current) {
      debugLog('sessionRoom', 'Skipping init because initialization already started.', { initKey });
      return;
    }
    if (activeInitKeyRef.current === initKey) {
      debugLog('sessionRoom', 'Skipping init because initKey is already active.', { initKey });
      return;
    }

    rtcInitStartedRef.current = true;
    activeInitKeyRef.current = initKey;

    setIsBusy(true);
    setNetworkError('');

    try {
      debugLog('sessionRoom', 'Initializing call.', {
        sessionId: session.id,
        role,
        shouldJoinStudent,
        forceRelayOnly,
      });

      if (shouldJoinStudent) {
        const selected =
          (user?.paymentMethods || []).find((card) => card.id === selectedCardId)
          || (user?.paymentMethods || []).find((card) => card.isDefault)
          || user?.paymentMethods?.[0];

        await joinSessionAsStudent(session, selected?.id || null, selected?.last4 || null);
      }

      const iceServers = await fetchIceServers();

      const controller = await createWebRtcSessionController({
        sessionId: session.id,
        role,
        currentUserId: user.uid,
        iceServers,
        forceRelayOnly,

        onLocalStream: (stream) => {
          if (!localVideoRef.current) return;
          localVideoRef.current.srcObject = stream;
        },

        onRemoteStream: (stream) => {
          if (!remoteVideoRef.current) return;
          remoteVideoRef.current.srcObject = stream;
        },

        onRemoteScreenStream: (stream) => {
          debugLog('sessionRoom', 'Received remote screen stream callback.', {
            hasStream: Boolean(stream),
          });
          setRemoteScreenStreamObj(stream || null);
        },

        onScreenShareStateChange: ({ local, remote }) => {
          setIsLocalScreenSharing(Boolean(local));
          setIsRemoteScreenSharing(Boolean(remote));

          if (!remote) {
            setRemoteScreenStreamObj(null);
            if (remoteScreenVideoRef.current) {
              remoteScreenVideoRef.current.srcObject = null;
            }
          }
        },

        onConnectionMessage: (message) => setConnectionMessage(message),
        onNetworkFailure: (message) => setNetworkError(message),

        onSessionState: async (state) => {
          if (state !== 'connected') return;
          if (connectionStartRecordedRef.current) return;
          connectionStartRecordedRef.current = true;

          const updates = {};
          if (!session.callStartedAt) {
            updates.callStartedAt = Date.now();
          }
          if (!session.billingStartedAt) {
            updates.billingStartedAt = Date.now();
          }

          if (Object.keys(updates).length > 0) {
            await updateSession(session.id, updates);
          }
        },
      });

      rtcRef.current = controller;
      setConnectionMessage(role === 'tutor' ? 'Waiting for student to join…' : 'Connecting…');

      debugLog('sessionRoom', 'WebRTC controller created successfully.', {
        sessionId: session.id,
        role,
      });
    } catch (error) {
      rtcInitStartedRef.current = false;
      debugLog('sessionRoom', 'Failed to initialize call.', {
        sessionId: session?.id || null,
        role,
        message: error.message,
      });
      setNetworkError(error.message || 'Unable to start call. Please retry.');
    } finally {
      activeInitKeyRef.current = '';
      setIsBusy(false);
    }
  }, [forceRelayOnly, role, selectedCardId, session, user]);

  useEffect(() => {
    if (!session) return;
    if (role !== 'tutor') return;
    if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(session.status)) return;
    initializeCall({ shouldJoinStudent: false });
  }, [initializeCall, role, session]);

  useEffect(() => {
    if (!session) return;
    if (role !== 'student') return;
    if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(session.status)) return;
    if (rtcRef.current || isBusy || autoJoinAttemptedRef.current || rtcInitStartedRef.current) return;

    autoJoinAttemptedRef.current = true;
    initializeCall({ shouldJoinStudent: session.status === SESSION_STATUS.WAITING_STUDENT });
  }, [initializeCall, isBusy, role, session]);

  useEffect(() => {
    if (!session?.status) return;
    if (![SESSION_STATUS.CANCELED, SESSION_STATUS.CANCELED_DURING].includes(session.status)) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  }, [navigate, role, session?.requestId, session?.status]);

  useEffect(() => {
    if (!session?.status) return;
    if (session.status !== SESSION_STATUS.COMPLETED) return;
    if (role !== 'student') return;

    navigate(`/app/student/request/${session.requestId}`, {
      replace: true,
      state: { requestId: session.requestId },
    });
  }, [navigate, role, session?.requestId, session?.status]);

  useEffect(() => {
    if (session) return;
    if (!hadSessionRef.current) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (role === 'student') {
      navigate('/app/student/request', { replace: true });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  }, [navigate, role, session]);

  const askCancellationReason = () => {
    const reason = window.prompt('Please tell us why you want to cancel this class.');

    if (reason === null) return null;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setNetworkError('Please enter a cancellation reason before canceling the class.');
      return null;
    }

    return trimmedReason;
  };

  const cancelCurrentClass = async () => {
    if (!session) return;

    const cancellationReason = askCancellationReason();
    if (!cancellationReason) return;

    const sessionSecondsForCancellation = Math.max(callSeconds, billedSeconds);
    const shouldChargeForCancellation = sessionSecondsForCancellation >= 30;
    const endedAt = Date.now();

    if (session.requestId) {
      await updateClassRequest(session.requestId, {
        status: REQUEST_STATUSES.CANCELED_DURING,
        canceledAt: endedAt,
        canceledBy: role,
        canceledReason: cancellationReason,
      });
    }

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    await updateSession(session.id, {
      status: SESSION_STATUS.CANCELED_DURING,
      endedAt,
      canceledAt: endedAt,
      canceledBy: role,
      canceledReason: cancellationReason,
      chargeOnCancellation: shouldChargeForCancellation,
      cancellationChargeApplies: shouldChargeForCancellation,
      cancellationBillableSeconds: shouldChargeForCancellation ? sessionSecondsForCancellation : 0,
      billingEndedAt: endedAt,
      ...(shouldChargeForCancellation ? {} : { billingStartedAt: null }),
    });

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  };

  const endCurrentSession = async () => {
    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    await endSession(session);

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor', { replace: true });
  };

  const submitRating = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    await submitSessionRating(session, role, {
      overall: Number(ratingForm.overall),
      topic: Number(ratingForm.topic),
      comment: ratingForm.comment,
    });

    setIsSaving(false);
  };

  const toggleMute = () => {
    const enabled = rtcRef.current?.toggleAudio?.();
    if (typeof enabled === 'boolean') {
      setIsMuted(!enabled);
    }
  };

  const shareScreen = async () => {
    try {
      if (isLocalScreenSharing) {
        await rtcRef.current?.stopScreenShare?.();
        setIsLocalScreenSharing(false);
        return;
      }

      await rtcRef.current?.startScreenShare?.();
      setIsLocalScreenSharing(true);
    } catch (error) {
      setNetworkError(error.message || 'Unable to share screen.');
    }
  };

  const toggleStudentControls = () => {
    setShowStudentControls((prev) => !prev);
  };

  const controlsCompact = isMobileViewport;
  const showStudentOverlay = role !== 'student' || !isMobileViewport || showStudentControls;
  const closeHref = role === 'tutor' ? '/app/tutor/sessions' : '/app';

  const renderTutorStageHeader = () => (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[calc(100vw-7rem)]">
      <div className="rounded-[24px] border border-white/12 bg-black p-3 shadow-2xl backdrop-blur-md ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StageBadge icon={Clock3} className="bg-[#1b2230]/98">
            Call {formatDuration(callSeconds)}
          </StageBadge>
          <StageBadge icon={BadgeDollarSign} className="bg-[#1b2230]/98">
            Billable {formatDuration(billedSeconds)}
          </StageBadge>
        </div>
      </div>
    </div>
  );

  const renderStudentStageHeader = () => (
    <div
      className={`absolute left-20 right-4 top-4 z-20 transition-opacity duration-200 ${
        showStudentOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="rounded-[22px] border border-white/10 bg-[#161b25]/88 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge icon={Clock3}>Call length {formatDuration(callSeconds)}</StageBadge>

          <StageBadge icon={Wifi} tone={connectionTone}>
            {connectionMessage || 'Connecting…'}
          </StageBadge>

          <StageBadge tone={networkError ? 'danger' : isRemoteScreenSharing ? 'success' : 'warning'}>
            {networkError
              ? 'Connection issue'
              : isRemoteScreenSharing
                ? 'Screen live'
                : 'Waiting for tutor to share'}
          </StageBadge>

          {session.status === SESSION_STATUS.WAITING_STUDENT ? (
            <StageBadge icon={Clock3} tone="warning">
              Join window {graceRemaining}s
            </StageBadge>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderTutorStage = () => (
    <div className="relative h-full w-full overflow-hidden bg-[#0f141d]">
      {renderTutorStageHeader()}
      <div className="absolute inset-0">
        <ExcalidrawEmbed roomId={whiteboardRoom} />
      </div>
    </div>
  );

  const renderStudentStage = () => (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onClick={toggleStudentControls}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleStudentControls();
        }
      }}
    >
      {renderStudentStageHeader()}

      {isRemoteScreenSharing ? (
        <video
          ref={remoteScreenVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md rounded-[28px] border border-white/10 bg-[#161b25]/88 p-6 text-center shadow-2xl backdrop-blur-md">
            <Presentation className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-4 text-base font-semibold text-zinc-100">
              No screen sharing has started yet.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              The tutor’s shared screen will appear here once sharing starts.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
          <p className="text-sm text-zinc-400">Session not found or no access.</p>
          <Link
            to="/app"
            className="mt-4 inline-flex rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-[#0B0F19] text-white">
      {isPortraitMobile ? (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 md:hidden">
          <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center shadow-2xl">
            <p className="text-lg font-semibold text-zinc-100">Rotate your device</p>
            <p className="mt-2 text-sm text-zinc-400">
              This tutoring room is best viewed in landscape so the board or shared screen can fill the page clearly.
            </p>
          </div>
        </div>
      ) : null}

      <HiddenMediaMounts
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteScreenVideoRef={role === 'student' ? null : remoteScreenVideoRef}
      />

      <div className="relative h-full w-full">
        {role === 'tutor' ? renderTutorStage() : renderStudentStage()}

        <div
          className={`absolute z-30 ${
            role === 'student' ? 'bottom-2 left-2' : 'bottom-2 right-2 top-2 flex items-center'
          } ${
            role === 'student'
              ? showStudentOverlay
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'
              : 'opacity-100'
          } transition-opacity duration-200`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-[#161b25]/88 p-2 shadow-2xl backdrop-blur-md">
            <RailButton
              onClick={toggleMute}
              icon={isMuted ? MicOff : Mic}
              label={isMuted ? 'Unmute' : 'Mute'}
              disabled={!rtcRef.current}
              active={!isMuted}
              compact={controlsCompact}
            />

            {role === 'tutor' ? (
              <RailButton
                onClick={shareScreen}
                icon={MonitorUp}
                label={isLocalScreenSharing ? 'Stop share' : 'Share screen'}
                disabled={!rtcRef.current}
                active={isLocalScreenSharing}
                compact={controlsCompact}
              />
            ) : null}

            <RailButton
              onClick={cancelCurrentClass}
              icon={X}
              label="Cancel"
              compact={controlsCompact}
            />

            {role === 'tutor' ? (
              <RailButton
                onClick={endCurrentSession}
                icon={PhoneOff}
                label="End class"
                danger
                compact={controlsCompact}
              />
            ) : null}
          </div>
        </div>

        {role === 'student' && !rtcRef.current && session.status === SESSION_STATUS.WAITING_STUDENT ? (
          <div
            className={`absolute bottom-4 right-4 z-30 transition-opacity duration-200 ${
              showStudentOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <button
              onClick={() => initializeCall({ shouldJoinStudent: true })}
              disabled={isBusy || rtcInitStartedRef.current}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {isBusy ? 'Joining...' : 'Join now'}
            </button>
          </div>
        ) : null}
      </div>

      {needsRating ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[32px] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-300" />
              <p className="text-lg font-semibold text-zinc-100">Rate this session</p>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={submitRating}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  Overall
                  <select
                    value={ratingForm.overall}
                    onChange={(event) =>
                      setRatingForm((prev) => ({ ...prev, overall: event.target.value }))
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-brand"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={`overall-${value}`} value={String(value)}>
                        {value}/5
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-zinc-300">
                  Topic specific
                  <select
                    value={ratingForm.topic}
                    onChange={(event) =>
                      setRatingForm((prev) => ({ ...prev, topic: event.target.value }))
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-brand"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={`topic-${value}`} value={String(value)}>
                        {value}/5
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm text-zinc-300">
                Feedback
                <textarea
                  value={ratingForm.comment}
                  onChange={(event) =>
                    setRatingForm((prev) => ({ ...prev, comment: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-brand"
                  rows={4}
                  placeholder="Optional feedback"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving rating...' : 'Submit rating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
