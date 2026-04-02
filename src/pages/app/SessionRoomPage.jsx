import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import SelectField from '../../components/ui/SelectField';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { BILLING_RULES, TUTOR_PAYOUT_RATE } from '../../utils/onboarding';
import { endSession, joinSessionAsStudent, submitSessionRating } from '../../services/sessionService';

function useLiveSeconds(startTs) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTs) return 0;
  return Math.max(0, Math.floor((tick - startTs) / 1000));
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function SessionRoomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(user?.uid);
  const { sessions: tutorSessions } = useTutorSessions(user?.uid);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const session = sessions.find((item) => item.id === id);
  const [ratingForm, setRatingForm] = useState({ overall: '5', topic: '5', comment: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '');

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const runningAmount = (billedSeconds / 60) * BILLING_RULES.DISPLAY_RATE_PER_MINUTE;
  const needsRating = session?.status === 'completed' && !session?.ratings?.[role];

  if (!session) {
    return (
      <div className="space-y-6">
        <PageHeader title="Session room" description="Session not found or no access." />
        <Link to="/app" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Back to dashboard</Link>
      </div>
    );
  }

  const joinAsStudent = async () => {
    const selected = (user?.paymentMethods || []).find((card) => card.id === selectedCardId)
      || (user?.paymentMethods || []).find((card) => card.isDefault)
      || user?.paymentMethods?.[0];
    await joinSessionAsStudent(session, selected?.id || null, selected?.last4 || null);
  };

  const endCurrentSession = async () => {
    await endSession(session);
  };

  const submitRating = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    await submitSessionRating(session, role, {
      overall: Number(ratingForm.overall),
      topic: Number(ratingForm.topic),
      comment: ratingForm.comment,
    });
    setIsSaving(false);
  };

  const graceRemaining = Math.max(0, Math.ceil(((session.joinGraceEndsAt || 0) - Date.now()) / 1000));
  const tldrawLicenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
  const whiteboardRoom = session.whiteboardRoomId || session.requestId || session.id;
  const whiteboardUrl = `https://www.tldraw.com/f/${encodeURIComponent(whiteboardRoom)}`;

  return (
    <div className="space-y-6">
      <PageHeader title={`Live Session: ${session.topic}`} description="In-app call and whiteboard placeholders are active for this phase." />

      <SectionCard title="Call status">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">On call</p>
            <p className="mt-1 text-xl font-black text-emerald-300">{formatDuration(callSeconds)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Billable time</p>
            <p className="mt-1 text-xl font-black text-sky-300">{formatDuration(billedSeconds)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Running total (R5/min)</p>
            <p className="mt-1 text-xl font-black text-white">R{runningAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
          <p className="text-sm font-semibold text-white">Collaborative whiteboard (tldraw)</p>
          <p className="mb-2 text-xs text-zinc-400">Use <code>VITE_TLDRAW_LICENSE_KEY</code> when you switch to a fully licensed SDK deployment flow.</p>
          <iframe title="tldraw board" src={whiteboardUrl} className="h-[420px] w-full rounded-xl border border-zinc-700 bg-white" />
          {tldrawLicenseKey ? <p className="mt-2 text-[11px] text-zinc-500">License key detected in env for SDK rollout readiness.</p> : null}
        </div>


        {role === 'student' && session.status === 'waiting_student' ? (
          <div className="mt-4 max-w-xs">
            <SelectField
              label="Payment card"
              name="paymentCard"
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
              options={(user?.paymentMethods || []).map((card) => ({
                value: card.id,
                label: `${card.nickname} •••• ${card.last4}${card.isDefault ? ' (Primary)' : ''}`,
              }))}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {role === 'student' && session.status === 'waiting_student' ? (
            <button onClick={joinAsStudent} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
              Join call (free join window: {graceRemaining}s)
            </button>
          ) : null}
          {session.status === 'in_progress' ? (
            <button onClick={endCurrentSession} className="rounded-2xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-200">
              End session
            </button>
          ) : null}
          {session.meetingLink ? (
            <a href={session.meetingLink} target="_blank" rel="noreferrer" className="rounded-2xl border border-sky-500/40 px-4 py-2 text-sm font-bold text-sky-200">
              Join Zoom meeting
            </a>
          ) : null}
        </div>

        {session.status === 'completed' ? (
          <p className="mt-4 text-sm text-emerald-300">
            Session billed at R5/min. Total: R{Number(session.totalAmount || 0).toFixed(2)}. Tutor share: R{Number(session.payoutBreakdown?.tutorAmount || 0).toFixed(2)} ({Math.round(TUTOR_PAYOUT_RATE * 100)}%).
          </p>
        ) : null}

        {session.status === 'completed' && session.paymentStatus === 'wallet_debt_recorded' ? (
          <p className="mt-2 text-sm text-amber-200">
            Card charge was declined. Outstanding balance moved to wallet debt.
            <Link to="/app/student/payment" className="ml-1 underline">Pay from wallet</Link>
          </p>
        ) : null}
        {role === 'tutor' ? (
          <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Student request context</p>
            <p className="mt-2 text-sm text-zinc-200">{session.requestDescription || 'No description provided.'}</p>
            {session.requestAttachment?.downloadUrl ? (
              <a
                href={session.requestAttachment.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-semibold text-sky-300 underline"
              >
                Open request attachment
              </a>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      {needsRating ? (
        <SectionCard title="Rate this session" subtitle="Submit both overall and topic-specific ratings.">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={submitRating}>
            <SelectField
              label="Overall"
              name="overall"
              value={ratingForm.overall}
              onChange={(event) => setRatingForm((prev) => ({ ...prev, overall: event.target.value }))}
              options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}/5` }))}
            />
            <SelectField
              label="Topic specific"
              name="topic"
              value={ratingForm.topic}
              onChange={(event) => setRatingForm((prev) => ({ ...prev, topic: event.target.value }))}
              options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}/5` }))}
            />
            <div className="md:col-span-3">
              <textarea
                value={ratingForm.comment}
                onChange={(event) => setRatingForm((prev) => ({ ...prev, comment: event.target.value }))}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-white"
                rows={3}
                placeholder="Optional feedback"
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isSaving ? 'Saving rating...' : 'Submit rating'}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}
