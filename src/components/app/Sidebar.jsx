import { Link, NavLink } from 'react-router-dom';
import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  Home,
  LogOut,
  UserCircle2,
  Users,
} from 'lucide-react';

const baseClass =
  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors';

const linksByRole = {
  student: [
    { to: '/app/student', label: 'Dashboard', icon: Home },
    { to: '/app/student/request-class', label: 'Request Class', icon: ClipboardList },
    { to: '/app/student/requests', label: 'My Requests', icon: CalendarClock },
  ],
  tutor: [
    { to: '/app/tutor', label: 'Dashboard', icon: Home },
    { to: '/app/tutor/available-requests', label: 'Available Requests', icon: Users },
    { to: '/app/tutor/my-classes', label: 'My Classes', icon: BookOpen },
  ],
};

export default function Sidebar({ role, onLogout }) {
  const links = linksByRole[role] || linksByRole.student;

  return (
    <aside className="flex h-full w-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/95 p-4">
      <Link to="/app" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white font-black">C</div>
        <div>
          <p className="text-sm text-zinc-400">Claxi</p>
          <p className="text-xs uppercase text-zinc-500">{role}</p>
        </div>
      </Link>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${baseClass} ${
                isActive ? 'bg-brand text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        <NavLink
          to="/app/profile"
          className={({ isActive }) =>
            `${baseClass} ${
              isActive ? 'bg-brand text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
            }`
          }
        >
          <UserCircle2 className="h-4 w-4" />
          Profile
        </NavLink>
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </aside>
  );
}
