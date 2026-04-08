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
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3 md:hidden">
      <div className="pointer-events-auto grid grid-cols-5 items-center gap-1 rounded-[26px] border border-zinc-200/90 bg-white/95 px-2 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              `flex h-11 min-w-11 flex-col items-center justify-center rounded-2xl border transition ${isActive
                ? 'border-emerald-100 bg-emerald-50 text-brand'
                : 'border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'}`
            }
          >
            <Icon className="h-4 w-4" />
            <span className="mt-0.5 text-[10px] font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
