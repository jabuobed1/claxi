import { BookOpen, CalendarClock, Home, ShieldCheck, Wallet } from 'lucide-react';

export function getRoleNavigation(role) {
  const normalized = String(role || 'student').toLowerCase();

  if (normalized === 'admin') {
    return [
      { to: '/app/admin', label: 'Home', icon: Home, end: true },
      { to: '/app/admin/tutors', label: 'Tutors', icon: ShieldCheck },
      { to: '/app/admin/payments', label: 'Payments', icon: Wallet },
    ];
  }

  if (normalized === 'tutor') {
    return [
      { to: '/app/tutor', label: 'Home', icon: Home, end: true },
      { to: '/app/tutor/available-requests', label: 'Schedule', icon: CalendarClock },
      { to: '/app/tutor/my-classes', label: 'Classes', icon: BookOpen },
      { to: '/app/tutor/payments', label: 'Payment', icon: Wallet },
    ];
  }

  return [
    { to: '/app/student', label: 'Home', icon: Home, end: true },
    { to: '/app/student/requests', label: 'My Classes', icon: BookOpen },
    { to: '/app/student/payment', label: 'Payment', icon: Wallet },
  ];
}
