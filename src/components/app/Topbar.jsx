import { Menu } from 'lucide-react';

export default function Topbar({ name, role, onMenuClick }) {
  return (
    <header className="mb-6 flex items-center justify-between rounded-3xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl border border-zinc-700 p-2 text-zinc-300 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm text-zinc-400">Welcome back</p>
          <p className="text-base font-bold text-white">{name}</p>
        </div>
      </div>
      <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-light">
        {role}
      </span>
    </header>
  );
}
