import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import RequestCard from '../../../components/app/RequestCard';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAcceptedRequests } from '../../../hooks/useClassRequests';

export default function MyClassesPage() {
  const { user } = useAuth();
  const { classes, isLoading } = useTutorAcceptedRequests(user?.uid);

  return (
    <div>
      <PageHeader title="My Classes" description="Track accepted, active, and completed classes." />

      <SectionCard>
        {isLoading ? (
          <LoadingState message="Syncing accepted classes..." />
        ) : classes.length ? (
          <div className="space-y-4">
            {classes.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <EmptyState title="No classes yet" description="Accept a class request to build your schedule." />
        )}
      </SectionCard>
    </div>
  );
}
