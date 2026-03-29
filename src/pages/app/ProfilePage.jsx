import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../../components/ui/SectionCard';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { getStudentOnboardingStatus, getTutorOnboardingStatus } from '../../utils/onboarding';

export default function ProfilePage() {
  const { user, logout, deleteAccount, setUser } = useAuth();
  const navigate = useNavigate();
  const studentStatus = getStudentOnboardingStatus(user);
  const tutorStatus = getTutorOnboardingStatus(user);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const removeAccount = async () => {
    if (confirmText !== 'DELETE') {
      setMessage('Type DELETE to confirm account deletion.');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount(user);
      setUser(null);
      navigate('/');
    } catch (error) {
      setMessage(error.message || 'Unable to delete account. You may need to sign in again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Account identity synced with Firebase Auth and Firestore users collection." />

      <SectionCard action={<button type="button" onClick={handleLogout} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Log out</button>}>
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Full name</dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">{user?.fullName || user?.displayName || 'No name set'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Role</dt>
            <dd className="mt-1 text-lg font-semibold capitalize text-zinc-900">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone number</dt>
            <dd className="mt-1 text-sm text-zinc-700">{user?.phoneNumber || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Student onboarding</dt>
            <dd className="mt-1 text-sm text-zinc-700">{studentStatus.complete ? 'Complete' : studentStatus.message}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Tutor onboarding</dt>
            <dd className="mt-1 text-sm text-zinc-700">{tutorStatus.complete ? 'Complete' : tutorStatus.message}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Saved cards</dt>
            <dd className="mt-1 text-sm text-zinc-700">{user?.paymentMethods?.length || 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Wallet balance</dt>
            <dd className="mt-1 text-sm text-zinc-700">R{Number(user?.wallet?.balance || 0).toFixed(2)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">User ID</dt>
            <dd className="mt-1 break-all text-sm text-zinc-700">{user?.uid}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Delete account" subtitle="This permanently removes your profile and access.">
        <div className="space-y-3">
          <p className="text-sm text-rose-600">Type DELETE below to confirm permanent account deletion.</p>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="w-full max-w-sm rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900"
            placeholder="Type DELETE"
          />
          <button
            type="button"
            onClick={removeAccount}
            disabled={isDeleting}
            className="rounded-2xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting account...' : 'Delete my account'}
          </button>
          {message ? <p className="text-sm text-rose-600">{message}</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
