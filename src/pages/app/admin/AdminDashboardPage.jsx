import { Link } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Admin Operations" description="Internal tools for tutor verification and payment exceptions." />
      <SectionCard>
        <div className="grid gap-3 md:grid-cols-2">
          <Link to="/app/admin/tutors" className="rounded-2xl border border-zinc-300 bg-white p-4 text-sm font-semibold text-zinc-800">
            Tutor verification queue
          </Link>
          <Link to="/app/admin/payments" className="rounded-2xl border border-zinc-300 bg-white p-4 text-sm font-semibold text-zinc-800">
            Payment exceptions
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
