export const REQUEST_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
};

export const statusConfig = {
  [REQUEST_STATUSES.PENDING]: {
    label: 'Pending',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  [REQUEST_STATUSES.ACCEPTED]: {
    label: 'Accepted',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  [REQUEST_STATUSES.IN_PROGRESS]: {
    label: 'In Progress',
    className: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  },
  [REQUEST_STATUSES.COMPLETED]: {
    label: 'Completed',
    className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
  },
  [REQUEST_STATUSES.CANCELED]: {
    label: 'Canceled',
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
};
