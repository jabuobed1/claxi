import { Outlet } from 'react-router-dom';
import Sidebar from '../components/app/Sidebar';
import Topbar from '../components/app/Topbar';
import AppBottomNav from '../components/app/AppBottomNav';
import { useAuth } from '../hooks/useAuth';

export default function AppShell() {
  const { user } = useAuth();
  const activeRole = String(user?.activeRole || user?.role || 'student').toLowerCase();

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-3 py-3 text-zinc-900 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[260px_1fr]">
        <div className="hidden md:block">
          <Sidebar role={activeRole} />
        </div>

        <div className="pb-24 md:pb-0">
          <Topbar name={user?.fullName || user?.displayName || 'Claxi User'} role={activeRole} />
          <Outlet />
        </div>
      </div>
      <AppBottomNav role={activeRole} />
    </div>
  );
}
