import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Power } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { getTutorOnboardingStatus } from '../../../utils/onboarding';
import { updateUserProfile } from '../../../services/userService';
import { acceptClassRequest, declineClassRequest } from '../../../services/classRequestService';

export default function TutorDashboardPage() {
  const { user, setUser } = useAuth();
  const { requests } = useTutorAvailableRequests(user?.uid);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const isOnline = user?.onlineStatus === 'online';
  const [now, setNow] = useState(Date.now());
  const [activeRequestId, setActiveRequestId] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleOnlineStatus = async () => {
    if (!onboardingStatus.complete) return;
    const profile = await updateUserProfile(user.uid, { onlineStatus: isOnline ? 'offline' : 'online' });
    setUser((prev) => ({ ...prev, ...profile }));
  };

  const respond = async (requestId, response) => {
    setActiveRequestId(requestId);
    if (response === 'accept') {
      await acceptClassRequest({
        requestId,
        tutorId: user.uid,
        tutorName: user.fullName || user.displayName || user.email,
        tutorEmail: user.email,
      });
    } else {
      await declineClassRequest({ requestId, tutorId: user.uid });
    }
    setActiveRequestId('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tutor Home" description="Go online to view requests and respond quickly." />

      {!onboardingStatus.complete ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {onboardingStatus.message} <Link className="font-semibold underline" to="/app/onboarding?role=tutor">Complete profile</Link>
        </div>
      ) : null}

      <SectionCard>
        <div className="rounded-3xl border border-emerald-200 bg-white p-4 md:p-6">
          <p className="text-2xl font-black text-zinc-900">Go online to view requests</p>
          <p className="mt-1 text-sm text-zinc-500">When you are online, new requests will appear below in real time.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white ${isOnline ? 'bg-rose-600' : 'bg-emerald-600'}`}
            >
              <Power className="h-4 w-4" />
              {isOnline ? 'Go Offline' : 'Go Online'}
            </button>
            <Link to="/app/tutor/available-requests" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700">
              Open full request list
            </Link>
          </div>
        </div>
      </SectionCard>

      {isOnline ? (
        <SectionCard title="Incoming requests">
          {requests.length ? (
            <div className="space-y-3">
              {requests.map((request) => {
                const secondsLeft = Math.max(0, Math.ceil(((request.offerExpiresAt || 0) - now) / 1000));
                return (
                  <div key={request.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="font-semibold text-zinc-900">{request.topic}</p>
                    <p className="text-sm text-zinc-600">{request.description || 'New class request'}</p>
                    <p className="mt-1 text-xs font-semibold text-amber-700">{secondsLeft}s remaining</p>
                    <div className="mt-3 flex gap-2">
                      <button disabled={activeRequestId === request.id} onClick={() => respond(request.id, 'accept')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Accept</button>
                      <button disabled={activeRequestId === request.id} onClick={() => respond(request.id, 'decline')} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700">Decline</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No requests yet. Stay online to receive offers.</p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
