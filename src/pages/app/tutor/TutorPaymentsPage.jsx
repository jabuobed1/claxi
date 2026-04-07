import {
  Banknote,
  BadgePercent,
  Wallet,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { PLATFORM_FEE_RATE, TUTOR_PAYOUT_RATE } from '../../../utils/onboarding';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorSessions } from '../../../hooks/useSessions';

function StatCard({ icon: Icon, label, value, tone = 'default', helper }) {
  const toneStyles = {
    default: 'border-zinc-200 bg-white text-zinc-900',
    emerald: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50/80 text-rose-900',
    blue: 'border-sky-200 bg-sky-50/80 text-sky-900',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneStyles[tone] || toneStyles.default}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
          {helper ? <p className="mt-2 text-sm text-zinc-600">{helper}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const { sessions } = useTutorSessions(user?.uid);

  const completed = sessions.filter((session) => session.status === 'completed');
  const gross = completed.reduce((sum, session) => sum + Number(session.totalAmount || 0), 0);
  const tutorNet = completed.reduce(
    (sum, session) => sum + Number(session.payoutBreakdown?.tutorAmount || 0),
    0
  );
  const platformNet = gross - tutorNet;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor Payments"
        description="Track your completed session earnings, payout split, and what was billed to students."
      />

      <SectionCard className="overflow-hidden border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-emerald-50/40 shadow-sm">
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 p-6 text-white shadow-lg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                  <Wallet className="h-4 w-4" />
                  Earnings Overview
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Your tutor payment dashboard
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                  View how much was charged, what your payout share is, and how your completed
                  sessions contribute to your earnings.
                </p>
              </div>

              <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                    Gross billed
                  </p>
                  <p className="mt-2 text-2xl font-black">R{gross.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                    Your payout
                  </p>
                  <p className="mt-2 text-2xl font-black">R{tutorNet.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <BadgePercent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Payout logic</h3>
                <p className="text-sm text-zinc-500">
                  A quick summary of how each completed session is split
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={BadgePercent}
                label="Platform fee"
                value={`${Math.round(PLATFORM_FEE_RATE * 100)}%`}
                tone="rose"
                helper="Retained by the platform from completed sessions."
              />
              <StatCard
                icon={GraduationCap}
                label="Tutor share"
                value={`${Math.round(TUTOR_PAYOUT_RATE * 100)}%`}
                tone="emerald"
                helper="Your portion from each successfully completed session."
              />
              <StatCard
                icon={Banknote}
                label="Gross billed"
                value={`R${gross.toFixed(2)}`}
                tone="blue"
                helper="Total amount charged across completed sessions."
              />
              <StatCard
                icon={TrendingUp}
                label="Platform amount"
                value={`R${platformNet.toFixed(2)}`}
                helper="Estimated platform portion based on completed sessions."
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="border border-zinc-200 bg-white shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Completed session payouts</h3>
            <p className="text-sm text-zinc-500">
              A breakdown of your earnings from each completed class
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700">
            {completed.length} session{completed.length === 1 ? '' : 's'}
          </div>
        </div>

        {completed.length ? (
          <div className="space-y-4">
            {completed.map((session, index) => {
              const totalAmount = Number(session.totalAmount || 0);
              const tutorAmount = Number(session.payoutBreakdown?.tutorAmount || 0);

              return (
                <div
                  key={session.id}
                  className="group rounded-3xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-50 p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-700">
                          {index + 1}
                        </span>
                        <p className="truncate text-base font-bold text-zinc-900">
                          {session.topic || 'Untitled session'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                        <span className="rounded-full bg-zinc-100 px-3 py-1">
                          Session ID: {session.id}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                          Completed
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 md:min-w-[320px]">
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Charged
                        </p>
                        <p className="mt-1 text-lg font-black text-zinc-900">
                          R{totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Tutor payout
                        </p>
                        <p className="mt-1 text-lg font-black text-emerald-800">
                          R{tutorAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200 text-zinc-500">
              <Wallet className="h-6 w-6" />
            </div>
            <h4 className="mt-4 text-lg font-bold text-zinc-900">No completed session payouts yet</h4>
            <p className="mt-2 text-sm text-zinc-500">
              Once your tutoring sessions are completed, your payout details will appear here.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}