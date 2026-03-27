import { Link } from 'react-router-dom';
import { BookOpenCheck, CalendarClock, Inbox } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import StatCard from '../../../components/ui/StatCard';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import RequestCard from '../../../components/app/RequestCard';
import NotificationFeed from '../../../components/app/NotificationFeed';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAcceptedRequests, useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { useTutorSessions } from '../../../hooks/useSessions';
import { useNotifications } from '../../../hooks/useNotifications';

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const { requests: availableRequests, isLoading: isAvailableLoading } = useTutorAvailableRequests();
  const { classes } = useTutorAcceptedRequests(user?.uid);
  const { sessions } = useTutorSessions(user?.uid);
  const { notifications } = useNotifications(user?.uid);
  const upcoming = sessions.filter((session) => ['accepted', 'scheduled', 'in_progress'].includes(session.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor Dashboard"
        description="Monitor incoming demand and run your accepted sessions."
        action={
          <Link to="/app/tutor/available-requests" className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
            View Incoming Requests
          </Link>
        }
      />

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
