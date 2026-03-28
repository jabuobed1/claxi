import { Link, NavLink } from 'react-router-dom';
import { CalendarDays, History, Home, Search, UserCircle2 } from 'lucide-react';

function navConfig(role) {
  if (role === 'tutor') {
    return [
      { to: '/app/tutor', label: 'Home', icon: Home },
      { to: '/app/tutor/available-requests', label: 'Search', icon: Search },
      { to: '/app/tutor/sessions', label: 'Schedule', icon: CalendarDays },
      { to: '/app/tutor/payments', label: 'History', icon: History },
      { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
    ];
  }

  return [
    { to: '/app/student', label: 'Home', icon: Home },
    { to: '/app/student/requests', label: 'Search', icon: Search },
    { to: '/app/student/sessions', label: 'Schedule', icon: CalendarDays },
    { to: '/app/student/wallet', label: 'History', icon: History },
    { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
  ];
}

export default function AppBottomNav({ role = 'student' }) {
  const links = navConfig(role);
  const quickAction = role === 'tutor' ? '/app/tutor/available-requests' : '/app/student/request-class';

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[min(92vw,420px)] md:hidden">
      <div className="relative rounded-[26px] border border-zinc-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
        <div className="grid grid-cols-5 items-center gap-3">
          {links.map(({ to, icon: Icon, label }, index) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-semibold ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`
              }
            >
              {index === 2 ? <span className="h-11" /> : null}
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <Link
          to={quickAction}
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-black text-white shadow-xl"
          aria-label="Quick Request Action"
        >
          <span className="text-3xl font-light leading-none">+</span>
        </Link>
      </div>
    </div>
  );
}
