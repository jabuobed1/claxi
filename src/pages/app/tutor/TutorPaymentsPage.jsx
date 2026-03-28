import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { PLATFORM_FEE_RATE, TUTOR_PAYOUT_RATE } from '../../../utils/onboarding';

export default function TutorPaymentsPage() {
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
          Every billed session applies the split automatically and allocates 70% to tutor payout balance.
        </p>
      </SectionCard>
    </div>
  );
}
