import { Clock3, DollarSign } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

export default function RequestCard({ request, action }) {
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 transition-all hover:border-brand/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{request.subject}</p>
          <h3 className="text-lg font-bold text-white">{request.topic}</h3>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p className="mt-3 text-sm text-zinc-400">{request.description}</p>

      <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-zinc-500" />
          {request.preferredDate} • {request.preferredTime} • {request.duration}
        </p>
        {request.budget ? (
          <p className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-zinc-500" />
            Budget: {request.budget}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
