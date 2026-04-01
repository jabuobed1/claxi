import { Bell, Menu, UserCircle2 } from 'lucide-react';

export default function Topbar({ onOpenNav }) {
  return (
    <header className="mb-6 rounded-3xl bg-transparent px-4 py-3 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenNav}
            className="rounded-full border border-zinc-200 h-11 w-11 text-zinc-600 flex items-center justify-center md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
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
    </header>
  );
}
