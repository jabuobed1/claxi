import { CalendarClock, Link as LinkIcon, User2 } from 'lucide-react';
import { getMeetingProviderLabel } from '../../constants/meetingProviders';
import StatusBadge from '../ui/StatusBadge';

export default function SessionCard({ session, role = 'student', action }) {
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 transition-all hover:border-brand/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{session.subject}</p>
          <h3 className="text-lg font-bold text-white">{session.topic}</h3>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-zinc-500" />
          {session.scheduledDate || 'TBD'} • {session.scheduledTime || 'TBD'} • {session.duration || '60 mins'}
        </p>
        <p className="flex items-center gap-2">
          <User2 className="h-4 w-4 text-zinc-500" />
          {role === 'student' ? session.tutorName || 'Tutor pending' : session.studentName || 'Student'}
        </p>
      </div>

      <p className="mt-2 text-sm text-zinc-400">Provider: {getMeetingProviderLabel(session.meetingProvider)}</p>
      {session.meetingLink ? (
        <a
          href={session.meetingLink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-brand"
        >
          <LinkIcon className="h-4 w-4" />
          Open meeting link
        </a>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Meeting link not added yet.</p>
      )}

      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
