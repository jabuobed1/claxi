import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TldrawSdkEmbed from '../../components/app/TldrawSdkEmbed';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { SESSION_STATUS } from '../../constants/lifecycle';
import { BILLING_RULES, TUTOR_PAYOUT_RATE } from '../../utils/onboarding';
import { endSession, joinSessionAsStudent, submitSessionRating, updateSession } from '../../services/sessionService';
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
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function SessionRoomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(user?.uid);
  const { sessions: tutorSessions } = useTutorSessions(user?.uid);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const session = sessions.find((item) => item.id === id);

  const [ratingForm, setRatingForm] = useState({ overall: '5', topic: '5', comment: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '');
  const [isBusy, setIsBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const rtcRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const runningAmount = (billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE;
  const needsRating = session?.status === SESSION_STATUS.COMPLETED && !session?.ratings?.[role];

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
  }, [session?.id, role]);

  useEffect(() => {
    return () => {
      rtcRef.current?.close?.();
      rtcRef.current = null;
    };
  }, []);

  const initializeCall = useCallback(async ({ shouldJoinStudent }) => {
    if (!session || !user?.uid) return;
    if (rtcRef.current || isBusy) return;
    setIsBusy(true);
    setNetworkError('');
    try {
      if (shouldJoinStudent) {
        const selected = (user?.paymentMethods || []).find((card) => card.id === selectedCardId)
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
        onConnectionMessage: (message) => setConnectionMessage(message),
        onNetworkFailure: (message) => setNetworkError(message),
        onSessionState: async (state) => {
          if (state !== 'connected') return;
          if (!session.callStartedAt) {
            await updateSession(session.id, {
              ...session,
              callStartedAt: Date.now(),
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

  if (!session) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-zinc-500">Session not found or no access.</p>
        <Link to="/app" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Back to dashboard</Link>
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
  };

  const endCurrentSession = async () => {
    rtcRef.current?.close?.();
    rtcRef.current = null;
    await endSession(session);
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
      await rtcRef.current?.startScreenShare?.();
    } catch (error) {
      setNetworkError(error.message || 'Unable to share screen.');
    }
  };

  const graceRemaining = Math.max(0, Math.ceil(((session.joinGraceEndsAt || 0) - Date.now()) / 1000));
  const tldrawLicenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
  const whiteboardRoom = session.whiteboardRoomId || session.requestId || session.id;

  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
      <div className="absolute inset-0">
        <TldrawSdkEmbed roomId={whiteboardRoom} licenseKey={tldrawLicenseKey} />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-transparent to-zinc-950/85" />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-200 backdrop-blur">
        <span className="font-semibold">{session.topic}</span>
        <span>•</span>
        <span>Call {formatDuration(callSeconds)}</span>
        <span>•</span>
        <span>Billable {formatDuration(billedSeconds)}</span>
        <span>•</span>
        <span>R{runningAmount.toFixed(2)}</span>
        {role === 'student' && session.status === SESSION_STATUS.WAITING_STUDENT ? <span>• Join window {graceRemaining}s</span> : null}
      </div>

      {connectionMessage ? (
        <p className="absolute left-4 top-20 z-20 rounded-xl border border-zinc-700 bg-zinc-950/85 px-3 py-2 text-xs text-zinc-100">
          {connectionMessage}
        </p>
      ) : null}
      {networkError ? (
        <p className="absolute left-4 top-32 z-20 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {networkError}
        </p>
      ) : null}

      <div className="absolute bottom-24 right-4 z-20 grid w-[min(36vw,360px)] gap-3 sm:w-[min(32vw,420px)]">
        <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/80 backdrop-blur">
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">You</p>
          <video ref={localVideoRef} autoPlay playsInline muted className="h-24 w-full bg-black object-cover sm:h-28" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/80 backdrop-blur">
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Remote</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="h-24 w-full bg-black object-cover sm:h-28" />
        </div>
      </div>

      {role === 'tutor' ? (
        <div className="absolute right-4 top-4 z-20 max-w-sm rounded-2xl border border-zinc-700/80 bg-zinc-950/85 p-3 text-xs text-zinc-200 backdrop-blur">
          <p className="font-semibold uppercase tracking-wide text-zinc-400">Student request context</p>
          <p className="mt-2 line-clamp-4 text-zinc-200">{session.requestDescription || 'No description provided.'}</p>
          {session.requestAttachment?.downloadUrl ? (
            <a
              href={session.requestAttachment.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex font-semibold text-sky-300 underline"
            >
              Open request attachment
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4">
        <div className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/90 p-3 backdrop-blur">
          <button onClick={toggleMute} className="rounded-xl border border-zinc-500/40 px-4 py-2 text-sm font-bold text-zinc-100" disabled={!rtcRef.current}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={toggleCamera} className="rounded-xl border border-zinc-500/40 px-4 py-2 text-sm font-bold text-zinc-100" disabled={!rtcRef.current}>
            {isCameraOff ? 'Camera on' : 'Camera off'}
          </button>
          {role === 'tutor' ? (
            <button onClick={shareScreen} className="rounded-xl border border-sky-500/40 px-4 py-2 text-sm font-bold text-sky-200" disabled={!rtcRef.current}>
              Share screen
            </button>
          ) : null}
          <button onClick={cancelCurrentClass} className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm font-bold text-amber-200">
            Cancel
          </button>
          {role === 'tutor' ? (
            <button onClick={endCurrentSession} className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-200">
              End Class
            </button>
          ) : null}
          {role === 'student' && !rtcRef.current && session.status === SESSION_STATUS.WAITING_STUDENT ? (
            <button onClick={() => initializeCall({ shouldJoinStudent: true })} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white" disabled={isBusy}>
              Join now
            </button>
          ) : null}
        </div>
      </div>

      {session.status === SESSION_STATUS.COMPLETED ? (
        <div className="absolute bottom-24 left-4 z-20 rounded-xl border border-emerald-500/30 bg-zinc-950/85 px-3 py-2 text-xs text-emerald-200">
          Total: R{Number(session.totalAmount || 0).toFixed(2)} • Tutor share: R{Number(session.payoutBreakdown?.tutorAmount || 0).toFixed(2)} ({Math.round(TUTOR_PAYOUT_RATE * 100)}%)
        </div>
      ) : null}

      {session.status === SESSION_STATUS.CANCELED ? (
        <div className="absolute bottom-24 left-4 z-20 rounded-xl border border-amber-500/30 bg-zinc-950/85 px-3 py-2 text-xs text-amber-200">
          Class canceled.
        </div>
      ) : null}

      {needsRating ? (
        <div className="absolute left-4 top-44 z-20 w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950/90 p-4 text-zinc-100 backdrop-blur">
          <p className="text-sm font-semibold">Rate this session</p>
          <form className="mt-3 grid gap-3" onSubmit={submitRating}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                Overall
                <select
                  value={ratingForm.overall}
                  onChange={(event) => setRatingForm((prev) => ({ ...prev, overall: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((value) => <option key={`overall-${value}`} value={String(value)}>{value}/5</option>)}
                </select>
              </label>
              <label className="text-xs">
                Topic specific
                <select
                  value={ratingForm.topic}
                  onChange={(event) => setRatingForm((prev) => ({ ...prev, topic: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((value) => <option key={`topic-${value}`} value={String(value)}>{value}/5</option>)}
                </select>
              </label>
            </div>
            <textarea
              value={ratingForm.comment}
              onChange={(event) => setRatingForm((prev) => ({ ...prev, comment: event.target.value }))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional feedback"
            />
            <button type="submit" disabled={isSaving} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {isSaving ? 'Saving rating...' : 'Submit rating'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
