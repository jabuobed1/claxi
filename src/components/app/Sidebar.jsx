import { Link, NavLink } from 'react-router-dom';
import { BookOpen, CalendarClock, Home, UserCircle2, Wallet } from 'lucide-react';

const baseClass = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors';

const linksByRole = {
  student: [
    { to: '/app/student', label: 'Home', icon: Home },
    { to: '/app/student/request-class', label: 'Schedule', icon: CalendarClock },
    { to: '/app/student/sessions', label: 'Classes', icon: BookOpen },
    { to: '/app/student/payment', label: 'Payment', icon: Wallet },
    { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
  ],
  tutor: [
    { to: '/app/tutor', label: 'Home', icon: Home },
    { to: '/app/tutor/available-requests', label: 'Schedule', icon: CalendarClock },
    { to: '/app/tutor/my-classes', label: 'Classes', icon: BookOpen },
    { to: '/app/tutor/payments', label: 'Payment', icon: Wallet },
    { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
  ],
};

export default function Sidebar({ role }) {
  const links = linksByRole[role] || linksByRole.student;

  return (
    <aside className="flex h-full w-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Link to="/app" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-black text-white">C</div>
        <div>
          <p className="text-sm text-zinc-600">Claxi</p>
          <p className="text-xs uppercase text-zinc-500">{role}</p>
        </div>
      </Link>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${baseClass} ${isActive ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
