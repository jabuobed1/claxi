import { Menu, User } from 'lucide-react';

export default function StudentTopNav({ displayName = 'Student' }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-5 sm:px-6">
      <button
        type="button"
        aria-label="More options"
        className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-black/45"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label="Student profile"
        title={displayName}
        className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-black/45"
      >
        <User className="h-5 w-5" />
      </button>
    </div>
  );
}
