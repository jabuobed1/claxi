import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarClock, ClipboardList, Home, Plus, Settings, UserCircle2, Users, Wallet } from 'lucide-react';

function navConfig(role) {
  if (role === 'tutor') {
    return [
      { to: '/app/tutor', label: 'Dashboard', icon: Home },
      { to: '/app/tutor/available-requests', label: 'Available Requests', icon: Users },
      { to: '/app/tutor/my-classes', label: 'My Classes', icon: BookOpen },
      { to: '/app/tutor/sessions', label: 'Sessions', icon: CalendarClock },
      { to: '/app/tutor/payments', label: 'Payments', icon: Wallet },
      { to: '/app/onboarding?role=tutor', label: 'Complete Profile', icon: ClipboardList },
      { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ];
  }

  return [
    { to: '/app/student', label: 'Dashboard', icon: Home },
    { to: '/app/student/request-class', label: 'Request Class', icon: ClipboardList },
    { to: '/app/student/requests', label: 'My Requests', icon: CalendarClock },
    { to: '/app/student/sessions', label: 'My Sessions', icon: BookOpen },
    { to: '/app/student/wallet', label: 'Wallet', icon: Wallet },
    { to: '/app/onboarding?role=student', label: 'Complete Profile', icon: ClipboardList },
    { to: '/app/profile', label: 'Profile', icon: UserCircle2 },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ];
}

export default function AppBottomNav({ role = 'student' }) {
  const links = navConfig(role);
  const centerIndex = Math.floor(links.length / 2);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-3 md:hidden">
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-1 overflow-x-auto rounded-[28px] border border-zinc-200/80 bg-white/95 px-2 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur">
        {links.map(({ to, icon: Icon, label }, index) => {
          const DisplayIcon = index === centerIndex ? Plus : Icon;

          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                `flex h-11 min-w-11 items-center justify-center rounded-2xl border transition ${isActive ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-transparent text-zinc-500 hover:bg-zinc-100'}`
              }
            >
              <DisplayIcon className="h-5 w-5" />
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
