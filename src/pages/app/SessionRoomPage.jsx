import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  ChevronUp,
  Clock3,
  BadgeDollarSign,
  LayoutPanelTop,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Star,
  Video,
  Wifi,
  AlertTriangle,
  X,
  Presentation,
} from 'lucide-react';
import TldrawSdkEmbed from '../../components/app/TldrawSdkEmbed';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { SESSION_STATUS } from '../../constants/lifecycle';
import { BILLING_RULES, TUTOR_PAYOUT_RATE } from '../../utils/onboarding';
import {
  endSession,
  joinSessionAsStudent,
  submitSessionRating,
  updateSession,
} from '../../services/sessionService';
import { createWebRtcSessionController } from '../../services/webrtcService';

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

function StatusPill({ icon: Icon, children, tone = 'default' }) {
  const toneClasses = {
    default: 'border-zinc-700 bg-zinc-900/90 text-zinc-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{children}</span>
    </div>
  );
}

function ControlButton({
  onClick,
  icon: Icon,
  label,
  danger = false,
  disabled = false,
  mobileCompact = false,
}) {
  const classes = danger
    ? 'border-rose-500/30 bg-rose-500 text-white hover:bg-rose-600'
    : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center rounded-2xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        mobileCompact
          ? `h-11 w-11 p-0 sm:h-auto sm:w-auto sm:min-w-[92px] sm:flex-col sm:gap-1 sm:px-4 sm:py-3 ${classes}`
          : `min-w-[92px] flex-col gap-1 px-4 py-3 ${classes}`,
      ].join(' ')}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span className={mobileCompact ? 'hidden sm:inline' : ''}>{label}</span>
    </button>
  );
}

function VideoCard({ title, videoRef, muted = false, rightSlot = null }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        {rightSlot}
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-48 w-full bg-black object-cover"
      />
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
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);

  const rtcRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const connectionStartRecordedRef = useRef(false);

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const runningAmount = (billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE;
  const needsRating = session?.status === SESSION_STATUS.COMPLETED && !session?.ratings?.[role];
  const tldrawLicenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
  const whiteboardRoom = session?.whiteboardRoomId || session?.requestId || session?.id;

  const stageTitle = useMemo(() => {
    if (role === 'tutor') return 'Whiteboard';
    return 'Shared screen';
  }, [role]);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
    connectionStartRecordedRef.current = false;
  }, [session?.id, role]);

  useEffect(() => {
    return () => {
      rtcRef.current?.close?.();
      rtcRef.current = null;
    };
  }, []);

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

  const initializeCall = useCallback(async ({ shouldJoinStudent }) => {
    if (!session || !user?.uid) return;
    if (rtcRef.current || isBusy) return;

    setIsBusy(true);
    setNetworkError('');

    try {
      if (shouldJoinStudent) {
        const selected =
          (user?.paymentMethods || []).find((card) => card.id === selectedCardId)
          || (user?.paymentMethods || []).find((card) => card.isDefault)
          || user?.paymentMethods?.[0];

        await joinSessionAsStudent(session, selected?.id || null, selected?.last4 || null);
      }

      const controller = await createWebRtcSessionController({
        sessionId: session.id,
        role,
        currentUserId: user.uid,

        onLocalStream: (stream) => {
          if (!localVideoRef.current) return;
          localVideoRef.current.srcObject = stream;
        },

        onRemoteStream: (stream) => {
          if (!remoteVideoRef.current) return;
          remoteVideoRef.current.srcObject = stream;
        },

        onRemoteScreenStream: (stream) => {
          if (!remoteScreenVideoRef.current) return;
          remoteScreenVideoRef.current.srcObject = stream || null;
        },

        onScreenShareStateChange: ({ local, remote }) => {
          setIsLocalScreenSharing(Boolean(local));
          setIsRemoteScreenSharing(Boolean(remote));
          if (!remote && remoteScreenVideoRef.current) {
            remoteScreenVideoRef.current.srcObject = null;
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
            await updateSession(session.id, {
              ...session,
              ...updates,
            });
          }
        },
      });

      rtcRef.current = controller;
      setConnectionMessage(role === 'tutor' ? 'Waiting for student to join…' : 'Connecting…');
    } catch (error) {
      setNetworkError(error.message || 'Unable to start call. Please retry.');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, role, selectedCardId, session, user]);

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
    if (rtcRef.current || isBusy || autoJoinAttemptedRef.current) return;

    autoJoinAttemptedRef.current = true;
    initializeCall({ shouldJoinStudent: session.status === SESSION_STATUS.WAITING_STUDENT });
  }, [initializeCall, isBusy, role, session]);

  useEffect(() => {
    if (!session?.status) return;
    if (session.status !== SESSION_STATUS.CANCELED) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  }, [navigate, role, session?.requestId, session?.status]);

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

  const cancelCurrentClass = async () => {
    rtcRef.current?.close?.();
    rtcRef.current = null;

    await updateSession(session.id, {
      ...session,
      status: SESSION_STATUS.CANCELED,
      endedAt: Date.now(),
      canceledAt: Date.now(),
      canceledBy: role,
      canceledReason: role === 'tutor' ? 'Canceled by tutor.' : 'Canceled by student.',
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
    await endSession(session);
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

  const toggleCamera = () => {
    const enabled = rtcRef.current?.toggleVideo?.();
    if (typeof enabled === 'boolean') {
      setIsCameraOff(!enabled);
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

  const graceRemaining = Math.max(0, Math.ceil(((session.joinGraceEndsAt || 0) - Date.now()) / 1000));

  const renderTutorMainStage = () => (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{stageTitle}</p>
          <p className="text-xs text-zinc-400">
            {isLocalScreenSharing ? 'You are sharing your screen' : 'Shared lesson workspace'}
          </p>
        </div>
        <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">
          {session.status}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <TldrawSdkEmbed roomId={whiteboardRoom} licenseKey={tldrawLicenseKey} />
      </div>
    </section>
  );

  const renderStudentMainStage = () => (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Shared screen</p>
          <p className="text-xs text-zinc-400">
            {isRemoteScreenSharing ? 'Tutor screen is live' : 'Waiting for tutor to start sharing'}
          </p>
        </div>
        <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">
          {session.status}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {isRemoteScreenSharing ? (
          <video
            ref={remoteScreenVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 text-center">
              <Presentation className="mx-auto h-8 w-8 text-zinc-500" />
              <p className="mt-4 text-base font-semibold text-zinc-100">
                No screen sharing has started yet.
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                The student will see the tutor’s shared screen here once the tutor starts sharing.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderRightPanel = () => (
    <aside className="hidden min-h-0 md:grid md:grid-rows-[auto_auto_auto_minmax(0,1fr)] md:gap-3">
      <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <LayoutPanelTop className="h-4 w-4 text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-100">Session details</p>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-zinc-300">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Topic</p>
            <p className="mt-1 font-medium text-zinc-100">{session.topic}</p>
          </div>

          {session.status === SESSION_STATUS.COMPLETED ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-300">Completed</p>
              <p className="mt-1 text-sm text-emerald-100">
                Total: R{Number(session.totalAmount || 0).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-emerald-200/90">
                Tutor share: R{Number(session.payoutBreakdown?.tutorAmount || 0).toFixed(2)} (
                {Math.round(TUTOR_PAYOUT_RATE * 100)}%)
              </p>
            </div>
          ) : null}

          {session.status === SESSION_STATUS.CANCELED ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-300">Canceled</p>
              <p className="mt-1 text-sm text-amber-100">Class canceled.</p>
            </div>
          ) : null}
        </div>
      </div>

      <VideoCard
        title={role === 'tutor' ? 'Student video' : 'Tutor video'}
        videoRef={remoteVideoRef}
        rightSlot={
          <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Remote
          </div>
        }
      />

      <VideoCard
        title={role === 'tutor' ? 'Tutor video' : 'Your video'}
        videoRef={localVideoRef}
        muted
        rightSlot={
          <div className="flex items-center gap-1 text-zinc-400">
            {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {isCameraOff ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          </div>
        }
      />

      {role === 'tutor' ? (
        <div className="min-h-0 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
          <p className="text-sm font-semibold text-zinc-100">Student request context</p>
          <div className="mt-3 max-h-full overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            {session.requestDescription || 'No description provided.'}
          </div>

          {session.requestAttachment?.downloadUrl ? (
            <a
              href={session.requestAttachment.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              Open request attachment
            </a>
          ) : null}
        </div>
      ) : (
        <div className="min-h-0 rounded-[28px] border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
          <p className="text-sm font-semibold text-zinc-100">Session panel</p>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            Keep your camera and microphone ready during the lesson.
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden bg-[#0B0F19] text-white">
      {isPortraitMobile ? (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 md:hidden">
          <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center shadow-2xl">
            <p className="text-lg font-semibold text-zinc-100">Rotate your device</p>
            <p className="mt-2 text-sm text-zinc-400">
              This tutoring room is best viewed in landscape so the student can see the board or shared screen clearly.
            </p>
          </div>
        </div>
      ) : null}

      <div className="border-b border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur md:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200">
                <Video className="h-3.5 w-3.5" />
                <span>{role === 'tutor' ? 'Tutor room' : 'Student room'}</span>
              </div>
              <div className="inline-flex max-w-full items-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100">
                <span className="truncate">{session.topic}</span>
              </div>
            </div>

            <div className="mt-2 hidden flex-wrap items-center gap-2 sm:flex">
              <StatusPill icon={Clock3}>Call {formatDuration(callSeconds)}</StatusPill>
              {role === 'tutor' ? (
                <>
                  <StatusPill icon={BadgeDollarSign}>Billable {formatDuration(billedSeconds)}</StatusPill>
                  <StatusPill icon={BadgeDollarSign} tone="info">
                    R{runningAmount.toFixed(2)}
                  </StatusPill>
                </>
              ) : null}
              {role === 'student' && session.status === SESSION_STATUS.WAITING_STUDENT ? (
                <StatusPill icon={Clock3} tone="warning">
                  Join window {graceRemaining}s
                </StatusPill>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {connectionMessage ? (
              <StatusPill icon={Wifi} tone="info">
                {connectionMessage}
              </StatusPill>
            ) : null}

            {networkError ? (
              <StatusPill icon={AlertTriangle} tone="danger">
                {networkError}
              </StatusPill>
            ) : null}

            <button
              onClick={() => setMobileDrawerOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 md:hidden"
              title="More"
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            <Link
              to="/app"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
            >
              <span className="hidden sm:inline">Close</span>
              <X className="h-4 w-4 sm:hidden" />
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-24 pt-2 sm:px-4 sm:pb-28 sm:pt-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_380px]">
          {role === 'tutor' ? renderTutorMainStage() : renderStudentMainStage()}
          {renderRightPanel()}
        </div>
      </div>

      {mobileDrawerOpen ? (
        <div className="absolute inset-x-0 bottom-24 z-40 mx-2 rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-100">Session menu</p>
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100"
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Topic</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">{session.topic}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill icon={Clock3}>Call {formatDuration(callSeconds)}</StatusPill>
                {role === 'tutor' ? (
                  <StatusPill icon={BadgeDollarSign}>R{runningAmount.toFixed(2)}</StatusPill>
                ) : null}
              </div>
            </div>

            <VideoCard
              title={role === 'tutor' ? 'Student video' : 'Tutor video'}
              videoRef={remoteVideoRef}
            />

            <VideoCard
              title={role === 'tutor' ? 'Tutor video' : 'Your video'}
              videoRef={localVideoRef}
              muted
            />

            {role === 'tutor' ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
                {session.requestDescription || 'No description provided.'}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-3 sm:px-4 sm:pb-4">
        <div className="pointer-events-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-2 rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur sm:p-3">
          <ControlButton
            onClick={toggleMute}
            icon={isMuted ? MicOff : Mic}
            label={isMuted ? 'Unmute' : 'Mute'}
            disabled={!rtcRef.current}
            mobileCompact
          />

          <ControlButton
            onClick={toggleCamera}
            icon={isCameraOff ? Camera : CameraOff}
            label={isCameraOff ? 'Camera on' : 'Camera off'}
            disabled={!rtcRef.current}
            mobileCompact
          />

          {role === 'tutor' ? (
            <ControlButton
              onClick={shareScreen}
              icon={MonitorUp}
              label={isLocalScreenSharing ? 'Stop share' : 'Share'}
              disabled={!rtcRef.current}
              mobileCompact
            />
          ) : null}

          <ControlButton
            onClick={cancelCurrentClass}
            icon={X}
            label="Cancel"
            mobileCompact
          />

          {role === 'tutor' ? (
            <ControlButton
              onClick={endCurrentSession}
              icon={PhoneOff}
              label="End"
              danger
              mobileCompact
            />
          ) : null}

          {role === 'student' && !rtcRef.current && session.status === SESSION_STATUS.WAITING_STUDENT ? (
            <button
              onClick={() => initializeCall({ shouldJoinStudent: true })}
              disabled={isBusy}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:min-w-[120px] sm:px-5 sm:py-4"
              type="button"
            >
              <span className="hidden sm:inline">{isBusy ? 'Joining...' : 'Join now'}</span>
              <Video className="h-4 w-4 sm:hidden" />
            </button>
          ) : null}
        </div>
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
