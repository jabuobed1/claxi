import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/app/Sidebar';
import Topbar from '../components/app/Topbar';
import AppBottomNav from '../components/app/AppBottomNav';
import { useAuth } from '../hooks/useAuth';

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-3 py-3 text-zinc-900 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[260px_1fr]">
        <div className="hidden md:block">
          <Sidebar role={user?.role} onLogout={handleLogout} />
        </div>

        {isOpen ? (
          <div className="fixed inset-0 z-40 bg-black/30 p-4 md:hidden">
            <div className="h-full max-w-[280px]">
              <Sidebar role={user?.role} onLogout={handleLogout} />
            </div>
            <button type="button" className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
          </div>
        ) : null}

        <div className="pb-24 md:pb-0">
          <Topbar name={user?.fullName || user?.displayName || 'Claxi User'} role={user?.role || 'student'} onMenuClick={() => setIsOpen(true)} />
          <Outlet />
        </div>
      </div>
      <AppBottomNav role={user?.role || 'student'} />
    </div>
  );
}
