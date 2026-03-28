import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { PLATFORM_FEE_RATE, TUTOR_PAYOUT_RATE } from '../../../utils/onboarding';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorSessions } from '../../../hooks/useSessions';

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const { sessions } = useTutorSessions(user?.uid);
  const completed = sessions.filter((session) => session.status === 'completed');
  const gross = completed.reduce((sum, session) => sum + Number(session.totalAmount || 0), 0);
  const tutorNet = completed.reduce((sum, session) => sum + Number(session.payoutBreakdown?.tutorAmount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Tutor Payments" description="Track session earnings and payout split." />

      <SectionCard title="Payout logic">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4">
            <p className="text-sm text-zinc-400">Platform fee</p>
            <p className="mt-1 text-2xl font-black text-rose-300">{Math.round(PLATFORM_FEE_RATE * 100)}%</p>
          </div>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4">
            <p className="text-sm text-zinc-400">Tutor share</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{Math.round(TUTOR_PAYOUT_RATE * 100)}%</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Gross billed: R{gross.toFixed(2)} • Tutor payout: R{tutorNet.toFixed(2)}.
        </p>
      </SectionCard>

      <SectionCard title="Completed session payouts">
        {completed.length ? (
          <div className="space-y-3">
            {completed.map((session) => (
              <div key={session.id} className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm text-zinc-200">
                <p className="font-semibold text-white">{session.topic}</p>
                <p>
                  Charged: R{Number(session.totalAmount || 0).toFixed(2)} • Tutor payout: R{Number(session.payoutBreakdown?.tutorAmount || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No completed session payouts yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
