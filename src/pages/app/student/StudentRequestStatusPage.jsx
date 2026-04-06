import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useStudentRequest } from '../../../hooks/useClassRequests';
import { useStudentSessions } from '../../../hooks/useSessions';
import { useAuth } from '../../../hooks/useAuth';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { cancelClassRequest } from '../../../services/classRequestService';

function getStatusCopy(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING].includes(status)) return 'Searching for tutors';
  if (status === REQUEST_STATUSES.OFFERED) return 'Waiting for tutor to accept';
  if (status === REQUEST_STATUSES.ACCEPTED) return 'Tutor accepted';
  if (status === REQUEST_STATUSES.IN_SESSION) return 'Session has started';
  if (status === REQUEST_STATUSES.WAITING_STUDENT || status === REQUEST_STATUSES.IN_PROGRESS) return 'Class link is ready';
  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) return 'No available tutor';
  if (status === REQUEST_STATUSES.COMPLETED) return 'Your session is complete';
  if (status === REQUEST_STATUSES.CANCELED) return 'This request has been canceled';
  if (status === REQUEST_STATUSES.EXPIRED) return 'Request expired';
  return 'Preparing your request';
}

function getStatusMeta(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING].includes(status)) {
    return {
      label: 'Matching in progress',
      tone: 'emerald',
      icon: Search,
      badge: 'We are finding the best tutor for you',
    };
  }

  if (status === REQUEST_STATUSES.OFFERED) {
    return {
      label: 'Tutor offer sent',
      tone: 'blue',
      icon: Clock3,
      badge: 'Waiting for tutor confirmation',
    };
  }

  if (status === REQUEST_STATUSES.ACCEPTED) {
    return {
      label: 'Tutor accepted',
      tone: 'violet',
      icon: CheckCircle2,
      badge: 'Preparing your class access',
    };
  }

  if (status === REQUEST_STATUSES.WAITING_STUDENT || status === REQUEST_STATUSES.IN_PROGRESS) {
    return {
      label: 'Class ready',
      tone: 'emerald',
      icon: CalendarClock,
      badge: 'You can now join from Classes',
    };
  }

  if (status === REQUEST_STATUSES.IN_SESSION) {
    return {
      label: 'Live session',
      tone: 'emerald',
      icon: BookOpen,
      badge: 'Your session is currently active',
    };
  }

  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) {
    return {
      label: 'Retrying match',
      tone: 'amber',
      icon: Search,
      badge: 'Looking for another tutor',
    };
  }

  if (status === REQUEST_STATUSES.COMPLETED) {
    return {
      label: 'Completed',
      tone: 'emerald',
      icon: CheckCircle2,
      badge: 'Your request has been completed',
    };
  }

  if (status === REQUEST_STATUSES.CANCELED) {
    return {
      label: 'Canceled',
      tone: 'rose',
      icon: XCircle,
      badge: 'This request is no longer active',
    };
  }

  if (status === REQUEST_STATUSES.EXPIRED) {
    return {
      label: 'Expired',
      tone: 'rose',
      icon: XCircle,
      badge: 'No tutor accepted within 3 minutes',
    };
  }

  return {
    label: 'Processing',
    tone: 'zinc',
    icon: Sparkles,
    badge: 'Preparing your request',
  };
}

function getProgressIndex(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING].includes(status)) return 1;
  if (status === REQUEST_STATUSES.OFFERED) return 2;
  if (status === REQUEST_STATUSES.ACCEPTED) return 3;
  if (
    status === REQUEST_STATUSES.WAITING_STUDENT ||
    status === REQUEST_STATUSES.IN_PROGRESS ||
    status === REQUEST_STATUSES.IN_SESSION ||
    status === REQUEST_STATUSES.COMPLETED
  ) {
    return 4;
  }
  return 1;
}

function getToneClasses(tone) {
  if (tone === 'emerald') {
    return {
      ring: 'border-emerald-200 bg-emerald-50',
      iconWrap: 'bg-emerald-100 text-emerald-700',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      text: 'text-emerald-700',
      gradient: 'from-emerald-500 via-teal-500 to-blue-500',
    };
  }

  if (tone === 'blue') {
    return {
      ring: 'border-blue-200 bg-blue-50',
      iconWrap: 'bg-blue-100 text-blue-700',
      badge: 'border-blue-200 bg-blue-50 text-blue-700',
      text: 'text-blue-700',
      gradient: 'from-blue-500 via-cyan-500 to-indigo-500',
    };
  }

  if (tone === 'violet') {
    return {
      ring: 'border-violet-200 bg-violet-50',
      iconWrap: 'bg-violet-100 text-violet-700',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
      text: 'text-violet-700',
      gradient: 'from-violet-500 via-fuchsia-500 to-blue-500',
    };
  }

  if (tone === 'amber') {
    return {
      ring: 'border-amber-200 bg-amber-50',
      iconWrap: 'bg-amber-100 text-amber-700',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      text: 'text-amber-700',
      gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    };
  }

  if (tone === 'rose') {
    return {
      ring: 'border-rose-200 bg-rose-50',
      iconWrap: 'bg-rose-100 text-rose-700',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      text: 'text-rose-700',
      gradient: 'from-rose-500 via-pink-500 to-red-500',
    };
  }

  return {
    ring: 'border-zinc-200 bg-zinc-50',
    iconWrap: 'bg-zinc-100 text-zinc-700',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    text: 'text-zinc-700',
    gradient: 'from-zinc-500 via-zinc-400 to-zinc-500',
  };
}

export default function StudentRequestStatusPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestId: requestIdParam } = useParams();
  const { state } = useLocation();
  const durationMinutes = Number(state?.durationMinutes || 10);
  const requestId = requestIdParam || state?.requestId || '';
  const { request } = useStudentRequest(requestId);
  const { sessions } = useStudentSessions(user?.uid);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  if (!requestId) {
    return <Navigate to="/app/student" replace />;
  }

  const currentStatus = request?.status;
  const statusText = getStatusCopy(currentStatus);
  const meta = getStatusMeta(currentStatus);
  const tone = getToneClasses(meta.tone);
  const StatusIcon = meta.icon;
  const progressIndex = getProgressIndex(currentStatus);

  const topic = request?.topic || state?.topic || 'Your request';
  const duration = request?.duration || `${durationMinutes} mins`;
  const canJoin =
    currentStatus === REQUEST_STATUSES.WAITING_STUDENT ||
    currentStatus === REQUEST_STATUSES.IN_PROGRESS ||
    currentStatus === REQUEST_STATUSES.IN_SESSION;
  const matchingSession = useMemo(
    () => sessions.find((item) => item.requestId === requestId),
    [requestId, sessions],
  );
  const shouldAutoOpenSession = canJoin && Boolean(matchingSession?.id);

  useEffect(() => {
    if (!shouldAutoOpenSession) return;
    navigate(`/app/session/${matchingSession.id}`, { replace: true });
  }, [matchingSession?.id, navigate, shouldAutoOpenSession]);

  const canCancel = ![REQUEST_STATUSES.CANCELED, REQUEST_STATUSES.COMPLETED, REQUEST_STATUSES.EXPIRED].includes(currentStatus);

  const submitCancel = async () => {
    if (!request?.id || !cancelReason.trim()) return;
    setIsCanceling(true);
    try {
      await cancelClassRequest({ requestId: request.id, canceledBy: 'student', reason: cancelReason });
      setShowCancelModal(false);
      setCancelReason('');
    } finally {
      setIsCanceling(false);
    }
  };

  const steps = [
    { id: 1, title: 'Request received' },
    { id: 2, title: 'Matching tutor' },
    { id: 3, title: 'Tutor accepted' },
    { id: 4, title: 'Class ready' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request Status"
        description="Track your request in real time while we prepare the best class experience for you."
      />

      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className={`relative overflow-hidden bg-gradient-to-r ${tone.gradient} px-6 py-8 text-white md:px-8 md:py-10`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_35%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                Live request update
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                {statusText}
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/90 md:text-base">
                We are keeping your request active and updating the status as it moves through the matching and scheduling process.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-[1.75rem] border border-white/20 bg-white/10 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    Current state
                  </p>
                  <p className="truncate text-lg font-bold text-white">{meta.label}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">{meta.badge}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard title="Request overview" subtitle="If the request takes a little longer, do not worry. The system continues trying to match you with the right tutor based on availability.">
          <div className="space-y-5">
            {request?.statusDetail ? (
              <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Latest update</p>
                <p className="mt-2 text-sm font-medium text-indigo-900">{request.statusDetail}</p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Topic</p>
                <p className="mt-2 break-words text-lg font-bold text-zinc-900">{topic}</p>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Duration</p>
                <p className="mt-2 text-lg font-bold text-zinc-900">{duration}</p>
              </div>
            </div>

            {canJoin ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Your online class link is ready. Open Classes to join the session.
                </p>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Actions" subtitle="Quick things the student may need right now.">
          <div className="space-y-3">
            {canJoin ? (
              <Link
                to={matchingSession?.id ? `/app/session/${matchingSession.id}` : '/app/student/sessions'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Join session
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}

            <Link
              to="/app/student/requests"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
            >
              View All Requests
            </Link>

            {canCancel ? (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
              >
                Cancel Request
              </button>
            ) : null}
          </div>
        </SectionCard>
      </div>
      {showCancelModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-lg font-black text-zinc-900">Cancel request</p>
            <p className="mt-1 text-sm text-zinc-600">Please provide a reason. This helps us improve matching quality.</p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Type your cancellation reason"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCancelModal(false)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold">
                Close
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isCanceling}
                onClick={submitCancel}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isCanceling ? 'Canceling...' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
