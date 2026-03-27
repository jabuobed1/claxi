import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingState from '../../../components/ui/LoadingState';
import RequestCard from '../../../components/app/RequestCard';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';

const filters = ['all', 'pending', 'accepted', 'scheduled', 'in_progress', 'completed', 'canceled'];

export default function StudentRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useStudentRequests(user?.uid);
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') {
      return requests;
    }
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  return (
    <div className="space-y-5">
      <PageHeader title="My Requests" description="Live status updates from Firestore keep your request feed current." />

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              statusFilter === filter
                ? 'bg-brand text-white'
                : 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {filter.replace('_', ' ')}
          </button>
        ))}
      </div>

      <SectionCard>
        {isLoading ? (
          <LoadingState message="Syncing your requests..." />
        ) : filtered.length ? (
          <div className="space-y-4">
            {filtered.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No requests for this filter"
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
