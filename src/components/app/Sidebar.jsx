import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getRoleNavigation } from '../../constants/navigation';

const baseClass = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors';

export default function Sidebar({ role, onNavigate, mobile = false }) {
  const links = getRoleNavigation(role);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
    navigate('/login');
  };

  return (
    <aside className="flex h-full w-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link to="/app" onClick={onNavigate} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-black text-white">C</div>
          <div>
            <p className="text-sm text-zinc-600">Claxi</p>
            <p className="text-xs uppercase text-zinc-500">{role}</p>
          </div>
        </Link>
        {mobile ? (
          <button type="button" onClick={onNavigate} className="rounded-xl border border-zinc-200 p-2 text-zinc-600" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            onClick={onNavigate}
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
          onClick={onNavigate}
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
