import { Link, NavLink } from 'react-router-dom';
import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  Home,
  LogOut,
  Settings,
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
    { to: '/app/student/sessions', label: 'My Sessions', icon: BookOpen },
    { to: '/app/student/wallet', label: 'Wallet', icon: CalendarClock },
    { to: '/app/onboarding?role=student', label: 'Complete Profile', icon: ClipboardList },
  ],
  tutor: [
    { to: '/app/tutor', label: 'Dashboard', icon: Home },
    { to: '/app/tutor/available-requests', label: 'Available Requests', icon: Users },
    { to: '/app/tutor/my-classes', label: 'My Classes', icon: BookOpen },
    { to: '/app/tutor/sessions', label: 'Sessions', icon: CalendarClock },
    { to: '/app/tutor/payments', label: 'Payments', icon: CalendarClock },
    { to: '/app/onboarding?role=tutor', label: 'Complete Profile', icon: ClipboardList },
  ],
};

export default function Sidebar({ role, onLogout }) {
  const links = linksByRole[role] || linksByRole.student;

  return (
    <aside className="flex h-full w-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Link to="/app" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-black text-white">C</div>
        <div>
          <p className="text-sm text-zinc-500">Claxi</p>
          <p className="text-xs uppercase text-zinc-400">{role}</p>
        </div>
      </Link>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${baseClass} ${
                isActive ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
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
              isActive ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`
          }
        >
          <UserCircle2 className="h-4 w-4" />
          Profile
        </NavLink>

        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `${baseClass} ${
              isActive ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </aside>
  );
}
