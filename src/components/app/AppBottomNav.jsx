import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarClock, Home, UserCircle2, Wallet } from 'lucide-react';

function navConfig(role) {
  if (role === 'tutor') {
    return [
      { to: '/app/tutor/my-classes', label: 'Classes', icon: BookOpen },
      { to: '/app/tutor/available-requests', label: 'Schedule', icon: CalendarClock },
      { to: '/app/tutor', label: 'Home', icon: Home, end: true },
      { to: '/app/tutor/payments', label: 'Payment', icon: Wallet },
      { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
    ];
  }

  return [
    { to: '/app/student/sessions', label: 'Classes', icon: BookOpen },
    { to: '/app/student/request-class', label: 'Schedule', icon: CalendarClock },
    { to: '/app/student', label: 'Home', icon: Home, end: true },
    { to: '/app/student/payment', label: 'Payment', icon: Wallet },
    { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
  ];
}

export default function AppBottomNav({ role = 'student' }) {
  const links = navConfig(role);

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 px-3 md:hidden">
      <div className="pointer-events-auto inline-flex items-center gap-1 rounded-[28px] border border-zinc-200/80 bg-white/95 px-2 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              `flex h-11 min-w-11 items-center justify-center rounded-2xl border transition ${isActive ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-transparent text-zinc-600 hover:bg-zinc-100'}`
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
