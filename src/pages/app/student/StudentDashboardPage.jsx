import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, PlayCircle } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import StatCard from '../../../components/ui/StatCard';
import SectionCard from '../../../components/ui/SectionCard';
import RequestCard from '../../../components/app/RequestCard';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingState from '../../../components/ui/LoadingState';
import NotificationFeed from '../../../components/app/NotificationFeed';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { useStudentSessions } from '../../../hooks/useSessions';
import { useNotifications } from '../../../hooks/useNotifications';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useStudentRequests(user?.uid);
  const { sessions } = useStudentSessions(user?.uid);
  const { notifications } = useNotifications(user?.uid);

  const activeRequests = requests.filter((request) => request.status === 'pending' || request.status === 'accepted');
  const upcoming = sessions.filter((session) =>
    ['accepted', 'scheduled', 'in_progress'].includes(session.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Dashboard"
        description="Track your class requests in real time and launch sessions quickly."
        action={
          <Link
            to="/app/student/request-class"
            className="inline-flex rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            Request New Class
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Requests" value={requests.length} icon={ClipboardList} />
        <StatCard title="Active Requests" value={activeRequests.length} icon={PlayCircle} tone="sky" />
        <StatCard title="Upcoming Sessions" value={upcoming.length} icon={CalendarClock} tone="zinc" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Latest activity" subtitle="Automatically synced using Firestore listeners.">
            {isLoading ? (
              <LoadingState message="Loading requests..." />
            ) : requests.length ? (
              <div className="space-y-4">
                {requests.slice(0, 3).map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No class requests yet"
                description="Create your first class request and tutors will see it instantly."
                action={
                  <Link to="/app/student/request-class" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
                    Create Request
                  </Link>
                }
              />
            )}
          </SectionCard>
        </div>

        <SectionCard title="Notifications" subtitle="Instant updates for accepts and scheduling.">
          <NotificationFeed notifications={notifications} />
        </SectionCard>
      </div>
    </div>
  );
}
