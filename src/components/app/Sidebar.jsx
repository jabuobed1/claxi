import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarClock, Home, LogOut, UserCircle2, Wallet } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const baseClass = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors';

const linksByRole = {
  student: [
    { to: '/app/student', label: 'Home', icon: Home, end: true },
    { to: '/app/student/request-class', label: 'Schedule', icon: CalendarClock },
    { to: '/app/student/sessions', label: 'Classes', icon: BookOpen },
    { to: '/app/student/payment', label: 'Payment', icon: Wallet },
  ],
  tutor: [
    { to: '/app/tutor', label: 'Home', icon: Home, end: true },
    { to: '/app/tutor/available-requests', label: 'Schedule', icon: CalendarClock },
    { to: '/app/tutor/my-classes', label: 'Classes', icon: BookOpen },
    { to: '/app/tutor/payments', label: 'Payment', icon: Wallet },
  ],
};

export default function Sidebar({ role }) {
  const links = linksByRole[role] || linksByRole.student;
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex w-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Link to="/app" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-black text-white">C</div>
        <div>
          <p className="text-sm text-zinc-600">Claxi</p>
          <p className="text-xs uppercase text-zinc-500">{role}</p>
        </div>
      </Link>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            className={({ isActive }) =>
              `${baseClass} ${isActive ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-zinc-200 pt-4">
        <NavLink
          to="/app/profile"
          className={({ isActive }) =>
            `${baseClass} ${isActive ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`
          }
        >
          <UserCircle2 className="h-4 w-4" />
          Profile
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className={`${baseClass} mt-1 w-full text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900`}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
