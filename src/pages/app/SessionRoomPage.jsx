import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
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
import TldrawSdkEmbed from '../../components/app/TldrawSdkEmbed';
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
      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${classes}`}
    >
      <Icon className="h-4.5 w-4.5" />
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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);

  const rtcRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const connectionStartRecordedRef = useRef(false);
  const activeInitKeyRef = useRef('');

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const runningAmount = (billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE;
  const needsRating = session?.status === SESSION_STATUS.COMPLETED && !session?.ratings?.[role];
  const tldrawLicenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
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
    autoJoinAttemptedRef.current = false;
    connectionStartRecordedRef.current = false;
    activeInitKeyRef.current = '';
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
    const initKey = `${session.id}:${role}`;
    if (rtcRef.current || isBusy || activeInitKeyRef.current === initKey) {
      return;
    }
    activeInitKeyRef.current = initKey;

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
      activeInitKeyRef.current = '';
      setIsBusy(false);
    }
  }, [forceRelayOnly, isBusy, role, selectedCardId, session, user]);

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
    <div className="pointer-events-none absolute left-20 right-4 top-4 z-20">
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
        <TldrawSdkEmbed roomId={whiteboardRoom} licenseKey={tldrawLicenseKey} />
      </div>
    </div>
  );

  const renderStudentStage = () => (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {renderStudentStageHeader()}

      {isRemoteScreenSharing ? (
        <video
          ref={remoteScreenVideoRef}
          autoPlay
          playsInline
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

        <div className="absolute bottom-4 left-4 top-4 z-30 flex items-center">
          <div className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-[#161b25]/88 p-2 shadow-2xl backdrop-blur-md">
            <Link
              to={closeHref}
              title="Close"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1f2430]/95 text-zinc-100 shadow-sm transition hover:bg-[#272d3a]"
            >
              <X className="h-4.5 w-4.5" />
            </Link>

            <RailButton
              onClick={toggleMute}
              icon={isMuted ? MicOff : Mic}
              label={isMuted ? 'Unmute' : 'Mute'}
              disabled={!rtcRef.current}
              active={!isMuted}
            />

            {role === 'tutor' ? (
              <RailButton
                onClick={shareScreen}
                icon={MonitorUp}
                label={isLocalScreenSharing ? 'Stop share' : 'Share screen'}
                disabled={!rtcRef.current}
                active={isLocalScreenSharing}
              />
            ) : null}

            <RailButton
              onClick={cancelCurrentClass}
              icon={X}
              label="Cancel"
            />

            {role === 'tutor' ? (
              <RailButton
                onClick={endCurrentSession}
                icon={PhoneOff}
                label="End class"
                danger
              />
            ) : null}
          </div>
        </div>

        {role === 'student' && !rtcRef.current && session.status === SESSION_STATUS.WAITING_STUDENT ? (
          <div className="absolute bottom-4 right-4 z-30">
            <button
              onClick={() => initializeCall({ shouldJoinStudent: true })}
              disabled={isBusy}
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
