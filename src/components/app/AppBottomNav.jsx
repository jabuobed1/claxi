import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarClock, ClipboardList, Home, Settings, UserCircle2, Users, Wallet } from 'lucide-react';

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white md:hidden">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              `flex h-11 min-w-11 items-center justify-center rounded-xl border ${isActive ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-transparent text-zinc-500 hover:bg-zinc-100'}`
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
