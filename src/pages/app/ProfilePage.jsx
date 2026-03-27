import SectionCard from '../../components/ui/SectionCard';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../hooks/useAuth';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Profile" description="Account identity synced with Firebase Auth and Firestore users collection." />

      <SectionCard>
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Full name</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{user?.fullName || user?.displayName || 'No name set'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Role</dt>
            <dd className="mt-1 text-lg font-semibold capitalize text-white">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone number</dt>
            <dd className="mt-1 text-sm text-zinc-300">{user?.phoneNumber || 'Not set'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">User ID</dt>
            <dd className="mt-1 break-all text-sm text-zinc-300">{user?.uid}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
