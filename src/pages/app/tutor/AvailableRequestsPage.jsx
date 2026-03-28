import { useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import RequestCard from '../../../components/app/RequestCard';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { acceptClassRequest } from '../../../services/classRequestService';
import { getTutorOnboardingStatus } from '../../../utils/onboarding';

export default function AvailableRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useTutorAvailableRequests();
  const [activeRequest, setActiveRequest] = useState(null);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const canAccept = onboardingStatus.complete && user?.onlineStatus === 'online';

  const handleAccept = async (requestId) => {
    try {
      if (!canAccept) {
        return;
      }

      setActiveRequest(requestId);
      await acceptClassRequest({
        requestId,
        tutorId: user.uid,
        tutorName: user.fullName || user.displayName || user.email,
        tutorEmail: user.email,
      });
    } finally {
      setActiveRequest(null);
    }
  };

  return (
    <div>
      <PageHeader title="Available Requests" description="Accept requests instantly. Status changes are reflected for students immediately." />
      {!canAccept ? (
        <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          You must be online with a completed tutor profile before accepting requests.
        </p>
      ) : null}

      <SectionCard>
        {isLoading ? (
          <LoadingState message="Listening for pending requests..." />
        ) : requests.length ? (
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                action={
                  <button
                    type="button"
                    disabled={!canAccept || activeRequest === request.id}
                    onClick={() => handleAccept(request.id)}
                    className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    {activeRequest === request.id ? 'Accepting...' : 'Accept Request'}
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No pending requests" description="Check back in a moment — this list updates in real time." />
        )}
      </SectionCard>
    </div>
  );
}
