import { useEffect, useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import RequestCard from '../../../components/app/RequestCard';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { acceptClassRequest, declineClassRequest } from '../../../services/classRequestService';
import { getTutorOnboardingStatus } from '../../../utils/onboarding';

export default function AvailableRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useTutorAvailableRequests(user?.uid);
  const [activeRequest, setActiveRequest] = useState(null);
  const [now, setNow] = useState(Date.now());
  const onboardingStatus = getTutorOnboardingStatus(user);
  const canAccept = onboardingStatus.complete && user?.onlineStatus === 'online';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResponse = async (requestId, response) => {
    try {
      if (!canAccept) {
        return;
      }

      setActiveRequest(requestId);
      if (response === 'accept') {
        await acceptClassRequest({
          requestId,
          tutorId: user.uid,
          tutorName: user.fullName || user.displayName || user.email,
          tutorEmail: user.email,
        });
      } else {
        await declineClassRequest({
          requestId,
          tutorId: user.uid,
        });
      }
    } finally {
      setActiveRequest(null);
    }
  };

  return (
    <div>
      <PageHeader title="Available Requests" description="Accept or decline in 10 seconds. Delayed requests move to the next tutor automatically." />
      {!canAccept ? (
        <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          You must be online with a completed tutor profile before accepting requests.
        </p>
      ) : null}

      <SectionCard>
        {isLoading ? (
          <LoadingState message="Listening for live tutor offers..." />
        ) : requests.length ? (
          <div className="space-y-4">
            {requests.map((request) => {
              const secondsLeft = Math.max(0, Math.ceil(((request.offerExpiresAt || 0) - now) / 1000));

              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-amber-200">{secondsLeft}s left</span>
                      <button
                        type="button"
                        disabled={!canAccept || activeRequest === request.id}
                        onClick={() => handleResponse(request.id, 'accept')}
                        className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
                      >
                        {activeRequest === request.id ? 'Submitting...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        disabled={!canAccept || activeRequest === request.id}
                        onClick={() => handleResponse(request.id, 'decline')}
                        className="rounded-2xl border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No pending requests" description="Stay online. Requests will appear here for 10 seconds each." />
        )}
      </SectionCard>
    </div>
  );
}
