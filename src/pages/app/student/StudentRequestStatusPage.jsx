import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';

function getStatusCopy(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING].includes(status)) return 'Searching for tutors';
  if (status === REQUEST_STATUSES.OFFERED) return 'Waiting for tutor to accept';
  if (status === REQUEST_STATUSES.ACCEPTED) return 'Tutor accepted, creating an online class link';
  if (status === REQUEST_STATUSES.WAITING_STUDENT || status === REQUEST_STATUSES.IN_PROGRESS) return 'Class link is ready';
  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) return 'No tutor accepted. Searching for another tutor';
  return 'Preparing your request';
}

export default function StudentRequestStatusPage() {
  const { user } = useAuth();
  const { state } = useLocation();
  const { requests } = useStudentRequests(user?.uid);
  const durationMinutes = Number(state?.durationMinutes || 10);
  const requestId = state?.requestId || '';

  const request = useMemo(() => requests.find((item) => item.id === requestId), [requests, requestId]);

  if (!requestId) {
    return <Navigate to="/app/student" replace />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Request" description="Track your request while we match you with the best tutor." />
      <SectionCard title="Request status">
        <p className="text-lg font-semibold text-zinc-900">{getStatusCopy(request?.status)}</p>
        <p className="mt-2 text-sm text-zinc-600">Topic: {request?.topic || state?.topic || 'Your request'}</p>
        <p className="text-sm text-zinc-600">Duration: {request?.duration || `${durationMinutes} mins`}</p>
        {request?.status === REQUEST_STATUSES.WAITING_STUDENT || request?.status === REQUEST_STATUSES.IN_PROGRESS ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">Online class link available. Open Classes to join.</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
