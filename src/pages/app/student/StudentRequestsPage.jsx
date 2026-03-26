import { Link } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingState from '../../../components/ui/LoadingState';
import RequestCard from '../../../components/app/RequestCard';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';

export default function StudentRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useStudentRequests(user?.uid);

  return (
    <div>
      <PageHeader title="My Requests" description="Live status updates from Firestore keep your request feed current." />

      <SectionCard>
        {isLoading ? (
          <LoadingState message="Syncing your requests..." />
        ) : requests.length ? (
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No requests yet"
            description="Post a request and tutors will be able to accept it right away."
            action={
              <Link to="/app/student/request-class" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
                Request Class
              </Link>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
