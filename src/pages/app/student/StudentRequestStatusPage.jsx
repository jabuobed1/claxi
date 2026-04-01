import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
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
import { REQUEST_STATUSES } from '../../../utils/requestStatus';

function getStatusCopy(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING].includes(status)) return 'Searching for tutors';
  if (status === REQUEST_STATUSES.OFFERED) return 'Waiting for tutor to accept';
  if (status === REQUEST_STATUSES.ACCEPTED) return 'Tutor accepted, creating an online class link';
  if (status === REQUEST_STATUSES.IN_SESSION) return 'Session has started';
  if (status === REQUEST_STATUSES.WAITING_STUDENT || status === REQUEST_STATUSES.IN_PROGRESS) return 'Class link is ready';
  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) return 'No tutor accepted. Searching for another tutor';
  if (status === REQUEST_STATUSES.COMPLETED) return 'Your session is complete';
  if (status === REQUEST_STATUSES.CANCELED) return 'This request has been canceled';
  if (status === REQUEST_STATUSES.EXPIRED) return 'Request expired because no tutor accepted in time';
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
  const { requestId: requestIdParam } = useParams();
  const { state } = useLocation();
  const durationMinutes = Number(state?.durationMinutes || 10);
  const requestId = requestIdParam || state?.requestId || '';
  const { request } = useStudentRequest(requestId);

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

  const canCancel =
    currentStatus === REQUEST_STATUSES.PENDING ||
    currentStatus === REQUEST_STATUSES.MATCHING ||
    currentStatus === REQUEST_STATUSES.OFFERED;

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

        <div className="bg-white px-6 py-6 md:px-8">
          <div className="grid gap-3 md:grid-cols-4">
            {steps.map((step) => {
              const active = progressIndex >= step.id;
              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        active ? 'bg-white text-zinc-900' : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {step.id}
                    </div>
                    <p className="text-sm font-semibold">{step.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard title="Request overview" subtitle="A clean summary of the request currently being processed.">
          <div className="space-y-5">
            <div className={`rounded-[1.5rem] border p-4 ${tone.ring}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Status</p>
                  <p className="break-words text-lg font-bold text-zinc-900">{statusText}</p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                  {meta.label}
                </div>
              </div>
            </div>

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
                to="/app/student/classes"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Open Classes
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}

            <Link
              to="/app/student/requests"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
            >
              View All Requests
            </Link>

            <Link
              to="/app/student/request-class"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
            >
              Request Another Class
            </Link>

            {canCancel ? (
              <button
                type="button"
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 opacity-80"
                title="Connect your cancel-request logic here"
              >
                Cancel Request
              </button>
            ) : null}

            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Helpful note</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                If the request takes a little longer, do not worry. The system continues trying to match you with the right tutor based on availability.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
