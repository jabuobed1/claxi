import { Bell, Menu, UserCircle2 } from 'lucide-react';

export default function Topbar({ name, role }) {
  return (
    <header className="mb-6 rounded-3xl border border-zinc-200 bg-white px-4 py-3 shadow-sm md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow">
            <span className="text-lg font-black">C</span>
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-900">Claxi</p>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">{role} portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="relative rounded-2xl border border-zinc-200 p-2 text-zinc-500">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow">
            <UserCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-500">Welcome back, {name}</p>
    </header>
  );
}
