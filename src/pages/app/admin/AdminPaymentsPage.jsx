import { useEffect, useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import { getPaymentExceptionsForAdmin, markPaymentExceptionReviewed } from '../../../services/sessionService';

export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      setItems(await getPaymentExceptionsForAdmin());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markReviewed = async (item) => {
    await markPaymentExceptionReviewed(item);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Exceptions" description="Review failed card charges moved to wallet debt." />
      <SectionCard>
        {isLoading ? <LoadingState message="Loading payment exceptions..." /> : null}
        {!isLoading && !items.length ? <EmptyState title="No payment exceptions" description="All recent session payments are clean." /> : null}
        {!isLoading && items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-300 bg-white p-4">
                <p className="font-semibold text-zinc-900">{item.topic}</p>
                <p className="text-sm text-zinc-600">Student: {item.studentName || item.studentEmail}</p>
                <p className="text-sm text-zinc-600">Amount: R{Number(item.totalAmount || 0).toFixed(2)}</p>
                <p className="text-xs text-zinc-500">Status: {item.paymentStatus}</p>
                <button onClick={() => markReviewed(item)} className="mt-2 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700">Mark reviewed</button>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
