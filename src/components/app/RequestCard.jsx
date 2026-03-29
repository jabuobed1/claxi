import { Clock3, DollarSign, UserCircle2 } from 'lucide-react';
import { getMeetingProviderLabel } from '../../constants/meetingProviders';
import StatusBadge from '../ui/StatusBadge';

export default function RequestCard({ request, action }) {
  return (
    <article className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{request.subject}</p>
          <h3 className="text-3xl font-black text-zinc-900">{request.topic}</h3>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p className="mt-3 text-base text-zinc-500">{request.description}</p>
      {request.imageAttachment ? <p className="mt-2 text-xs text-indigo-500">Image attached</p> : null}

      <div className="mt-4 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-zinc-400" />
          {request.preferredDate || 'ASAP'} • {request.preferredTime || 'Now'} • {request.duration || 'Flexible'}
        </p>
        <p className="text-zinc-500">Provider pref: {getMeetingProviderLabel(request.meetingProviderPreference)}</p>
        {request.budget ? (
          <p className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-zinc-400" />
            Budget: {request.budget}
          </p>
        ) : null}
        {request.tutorName ? (
          <p className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-zinc-400" />
            Tutor: {request.tutorName}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
