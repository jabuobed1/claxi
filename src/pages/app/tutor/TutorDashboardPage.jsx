import { Link } from 'react-router-dom';
import { BookOpenCheck, CalendarClock, Inbox } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import StatCard from '../../../components/ui/StatCard';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import RequestCard from '../../../components/app/RequestCard';
import NotificationFeed from '../../../components/app/NotificationFeed';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAcceptedRequests, useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { useTutorSessions } from '../../../hooks/useSessions';
import { useNotifications } from '../../../hooks/useNotifications';
import { getTutorOnboardingStatus } from '../../../utils/onboarding';
import { updateUserProfile } from '../../../services/userService';

export default function TutorDashboardPage() {
  const { user, setUser } = useAuth();
  const { requests: availableRequests, isLoading: isAvailableLoading } = useTutorAvailableRequests();
  const { classes } = useTutorAcceptedRequests(user?.uid);
  const { sessions } = useTutorSessions(user?.uid);
  const { notifications } = useNotifications(user?.uid);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const isOnline = user?.onlineStatus === 'online';
  const upcoming = sessions.filter((session) => ['accepted', 'scheduled', 'in_progress'].includes(session.status));

  const toggleOnlineStatus = async () => {
    if (!onboardingStatus.complete) {
      return;
    }

    const profile = await updateUserProfile(user.uid, {
      onlineStatus: isOnline ? 'offline' : 'online',
    });
    setUser((prev) => ({ ...prev, ...profile }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor Dashboard"
        description="Monitor incoming demand and run your accepted sessions."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold ${
                onboardingStatus.complete
                  ? isOnline
                    ? 'bg-emerald-600 text-white'
                    : 'border border-zinc-600 bg-zinc-900 text-zinc-200'
                  : 'cursor-not-allowed border border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              {onboardingStatus.complete ? (isOnline ? 'Go Offline' : 'Go Online') : 'Complete profile to go online'}
            </button>
            <Link to="/app/tutor/available-requests" className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
              View Incoming Requests
            </Link>
          </div>
        }
      />

      <OnboardingStatusBanner user={user} role="tutor" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Available Requests" value={availableRequests.length} icon={Inbox} />
        <StatCard title="Accepted Classes" value={classes.length} icon={BookOpenCheck} tone="sky" />
        <StatCard title="Upcoming Sessions" value={upcoming.length} icon={CalendarClock} tone="zinc" />
        <StatCard title="Earnings" value="—" icon={CalendarClock} tone="zinc" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Live request feed" subtitle="New student requests appear here in real time.">
            {isAvailableLoading ? (
              <LoadingState message="Loading incoming requests..." />
            ) : availableRequests.length ? (
              <div className="space-y-4">
                {availableRequests.slice(0, 3).map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState title="No pending requests" description="You're all caught up for now." />
            )}
          </SectionCard>
        </div>

        <SectionCard title="Notifications" subtitle="Live updates across your classes.">
          <NotificationFeed notifications={notifications} />
        </SectionCard>
      </div>
    </div>
  );
}
