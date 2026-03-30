import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useAuth } from '../../../hooks/useAuth';
import { createClassRequest } from '../../../services/classRequestService';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { LESSON_DURATION_OPTIONS } from '../../../utils/pricing';

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
  const [durationMinutes, setDurationMinutes] = useState(Number(state?.durationMinutes || 10));
  const [cardId, setCardId] = useState(state?.cardId || user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');

  const request = useMemo(() => requests.find((item) => item.id === requestId), [requests, requestId]);

  if (!state?.topic) {
    return <Navigate to="/app/student" replace />;
  }

  const confirmRequest = async () => {
    setError('');
    setIsConfirming(true);

    try {
      const id = await createClassRequest({
        topic: state.topic,
        description: state.description,
        preferredDate: '',
        preferredTime: '',
        duration: `${durationMinutes} mins`,
        meetingProviderPreference: 'any',
        mode: 'online',
        imageAttachment: '',
        studentId: user.uid,
        studentName: user.fullName || user.displayName || user.email,
        studentEmail: user.email,
        selectedCardId: cardId,
      });
      setRequestId(id);
    } catch (confirmError) {
      setError(confirmError.message || 'Unable to submit request right now.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Request" description="Track your request while we match you with the best tutor." />

      {!requestId ? (
        <SectionCard title="Confirm request details">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Lesson duration
              <select
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {LESSON_DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-zinc-700">
              Payment card
              <select
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {(user?.paymentMethods || []).map((card) => (
                  <option key={card.id} value={card.id}>{card.nickname} •••• {card.last4} {card.isDefault ? '(Primary)' : ''}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={isConfirming || !cardId}
            onClick={confirmRequest}
            className="mt-4 rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {isConfirming ? 'Confirming...' : 'Confirm'}
          </button>
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        </SectionCard>
      ) : (
        <SectionCard title="Request status">
          <p className="text-lg font-semibold text-zinc-900">{getStatusCopy(request?.status)}</p>
          <p className="mt-2 text-sm text-zinc-600">Topic: {state.topic}</p>
          <p className="text-sm text-zinc-600">Duration: {durationMinutes} minutes</p>
          {request?.status === REQUEST_STATUSES.WAITING_STUDENT || request?.status === REQUEST_STATUSES.IN_PROGRESS ? (
            <p className="mt-3 text-sm font-medium text-emerald-700">Online class link available. Open Classes to join.</p>
          ) : null}
        </SectionCard>
      )}
    </div>
  );
}
