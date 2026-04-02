import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/app/Sidebar';
import Topbar from '../components/app/Topbar';
import TutorOfferOverlay from '../components/app/TutorOfferOverlay';
import SessionRatingPrompt from '../components/app/SessionRatingPrompt';
import { useAuth } from '../hooks/useAuth';

export default function AppShell() {
  const { user } = useAuth();
  const activeRole = String(user?.activeRole || user?.role || 'student').toLowerCase();
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-3 py-3 text-zinc-900 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[260px_1fr]">
        <div className="hidden md:block md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
          <Sidebar role={activeRole} />
        </div>

        <div>
          {activeRole === 'tutor' ? <TutorOfferOverlay /> : null}
          <SessionRatingPrompt />
          <Topbar
            name={user?.fullName || user?.displayName || 'Claxi User'}
            role={activeRole}
            onOpenNav={() => setIsNavOpen(true)}
          />
          <Outlet />
        </div>
      </div>

      {isNavOpen ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
          />
          <div className="absolute left-3 top-3 bottom-3 w-[85%] max-w-xs">
            <Sidebar role={activeRole} mobile onNavigate={() => setIsNavOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
