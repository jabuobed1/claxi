import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/userService';
import { addPaymentMethod, removePaymentMethod, setDefaultPaymentMethod } from '../../services/paymentMethodService';
import { initializeCardAuthorization } from '../../services/paystackService';
import {
  getStudentOnboardingStatus,
  getTutorOnboardingStatus,
  TUTOR_VERIFICATION_STATUSES,
} from '../../utils/onboarding';

function CardList({ cards, onSetDefault, onRemove }) {
  if (!cards.length) {
    return <p className="text-sm text-zinc-400">No cards added yet.</p>;
  }

  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-3">
          <div>
            <p className="text-sm font-semibold text-white">{card.nickname}</p>
            <p className="text-xs text-zinc-400">{card.brand} •••• {card.last4}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetDefault(card.id)}
              className="rounded-xl border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-200"
            >
              {card.isDefault ? 'Primary' : 'Set Primary'}
            </button>
            <button type="button" onClick={() => onRemove(card.id)} className="rounded-xl border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200">
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryRole = searchParams.get('role');
  const role = queryRole === 'tutor' ? 'tutor' : 'student';
  const [statusMessage, setStatusMessage] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [pendingAuthorization, setPendingAuthorization] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');

  const studentStatus = useMemo(() => getStudentOnboardingStatus(user), [user]);
  const tutorStatus = useMemo(() => getTutorOnboardingStatus(user), [user]);

  const saveStudentProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const profile = await updateUserProfile(user.uid, {
      studentProfile: {
        grade: formData.get('grade')?.toString().trim() || '',
        curriculum: formData.get('curriculum')?.toString().trim() || '',
        discoverySource: formData.get('discoverySource')?.toString().trim() || '',
      },
    });

    setUser((prev) => ({ ...prev, ...profile }));
    setStatusMessage('Student profile details saved.');
  };

  const saveTutorProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const mathScore = Number(formData.get('mathScore'));

    const profile = await updateUserProfile(user.uid, {
      profilePhoto: formData.get('profilePhoto')?.toString().trim() || user?.profilePhoto || '',
      tutorProfile: {
        highestGradeResultUrl: formData.get('highestGradeResultUrl')?.toString().trim() || '',
        mathScore,
        gradesToTutor: (formData.get('gradesToTutor')?.toString() || '').split(',').map((item) => item.trim()).filter(Boolean),
        topics: (formData.get('topics')?.toString() || '').split(',').map((item) => item.trim()).filter(Boolean),
        verificationStatus: mathScore >= 60 ? TUTOR_VERIFICATION_STATUSES.VERIFIED : TUTOR_VERIFICATION_STATUSES.REJECTED,
        payout: {
          bankName: formData.get('bankName')?.toString().trim() || '',
          accountNumber: formData.get('accountNumber')?.toString().trim() || '',
          accountHolder: formData.get('accountHolder')?.toString().trim() || '',
        },
      },
      subjects: ['mathematics'],
    });

    setUser((prev) => ({ ...prev, ...profile }));
    setStatusMessage(mathScore >= 60 ? 'Tutor profile submitted and auto-verified for MVP.' : 'Tutor profile saved, score below 60% threshold.');
  };

  const addCard = async () => {
    try {
      await initializeCardAuthorization({
        email: user.email,
        amount: 0, // Zero amount for authorization only
        onSuccess: (response) => {
          // In a real implementation, you'd verify the payment on your backend
          // and get the authorization details. For now, we'll simulate this.
          const mockAuthorization = {
            authorization_code: `AUTH_${response.reference}`,
            last4: '4242', // This would come from backend verification
            brand: 'Visa', // This would come from backend verification
          };
          setPendingAuthorization(mockAuthorization);
          setShowNicknameModal(true);
        },
        onClose: () => {
          setStatusMessage('Card authorization cancelled.');
        },
      });
    } catch (error) {
      setStatusMessage(`Failed to initialize payment: ${error.message}`);
    }
  };

  const saveCardWithNickname = async () => {
    if (!pendingAuthorization || !nicknameInput.trim()) {
      return;
    }

    try {
      const next = await addPaymentMethod(user, {
        nickname: nicknameInput.trim(),
        paystackAuthorization: pendingAuthorization,
      });
      setUser((prev) => ({ ...prev, ...next }));
      setStatusMessage('Card added successfully and ready for future payments.');
      setShowNicknameModal(false);
      setPendingAuthorization(null);
      setNicknameInput('');
    } catch (error) {
      setStatusMessage(`Failed to save card: ${error.message}`);
    }
  };

  const handleSetDefault = async (cardId) => {
    const next = await setDefaultPaymentMethod(user, cardId);
    setUser((prev) => ({ ...prev, ...next }));
    setStatusMessage('Primary card updated.');
  };

  const handleRemoveCard = async (cardId) => {
    const next = await removePaymentMethod(user, cardId);
    setUser((prev) => ({ ...prev, ...next }));
    setStatusMessage('Card removed.');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Complete Your Profile" description="Profile and payment completion is required before live requests and tutoring." />

      {statusMessage ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{statusMessage}</p> : null}

      {role === 'student' ? (
        <>
          <SectionCard title="Student setup" subtitle={studentStatus.message}>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={saveStudentProfile}>
              <FormField label="Grade" name="grade" defaultValue={user?.studentProfile?.grade || ''} placeholder="Grade 11" required />
              <FormField label="Curriculum" name="curriculum" defaultValue={user?.studentProfile?.curriculum || ''} placeholder="CAPS" required />
              <FormField
                label="How did you hear about us?"
                name="discoverySource"
                defaultValue={user?.studentProfile?.discoverySource || ''}
                placeholder="Instagram"
                required
              />
              <div className="md:col-span-3">
                <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Save student profile</button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Payment methods (Paystack)">
            <div className="space-y-4">
              <button
                type="button"
                onClick={addCard}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand/90 transition-colors"
              >
                Add a Card
              </button>
              <p className="text-sm text-zinc-400">
                Click "Add a Card" to securely authorize your card through Paystack for future payments.
              </p>
            </div>

            <div className="mt-4">
              <CardList cards={user?.paymentMethods || []} onSetDefault={handleSetDefault} onRemove={handleRemoveCard} />
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Tutor setup" subtitle={tutorStatus.message}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveTutorProfile}>
            <FormField
              label="Highest grade result file URL"
              name="highestGradeResultUrl"
              defaultValue={user?.tutorProfile?.highestGradeResultUrl || ''}
              placeholder="https://..."
              required
            />
            <FormField label="Math score %" name="mathScore" type="number" defaultValue={user?.tutorProfile?.mathScore ?? ''} required />
            <FormField
              label="Grades to tutor (comma separated)"
              name="gradesToTutor"
              defaultValue={(user?.tutorProfile?.gradesToTutor || []).join(', ')}
              placeholder="Grade 8, Grade 9"
              required
            />
            <FormField
              label="Math topics (comma separated)"
              name="topics"
              defaultValue={(user?.tutorProfile?.topics || []).join(', ')}
              placeholder="Algebra, Trigonometry"
              required
            />
            <FormField label="Bank name" name="bankName" defaultValue={user?.tutorProfile?.payout?.bankName || ''} required />
            <FormField label="Account number" name="accountNumber" defaultValue={user?.tutorProfile?.payout?.accountNumber || ''} required />
            <FormField label="Account holder" name="accountHolder" defaultValue={user?.tutorProfile?.payout?.accountHolder || ''} required />
            <FormField label="Profile photo URL" name="profilePhoto" defaultValue={user?.profilePhoto || ''} placeholder="https://..." required />
            <div className="md:col-span-2">
              <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Save tutor profile</button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );

  // Nickname Modal
  if (showNicknameModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full">
          <h3 className="text-lg font-bold text-white mb-4">Name Your Card</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Your card ending in {pendingAuthorization?.last4} has been authorized. Give it a nickname for easy identification.
          </p>
          <FormField
            label="Card nickname"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="My Main Card"
            required
          />
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowNicknameModal(false);
                setPendingAuthorization(null);
                setNicknameInput('');
              }}
              className="flex-1 rounded-xl border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCardWithNickname}
              disabled={!nicknameInput.trim()}
              className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Card
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Complete Your Profile" description="Profile and payment completion is required before live requests and tutoring." />

      {statusMessage ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{statusMessage}</p> : null}

      {role === 'student' ? (
        <>
          <SectionCard title="Student setup" subtitle={studentStatus.message}>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={saveStudentProfile}>
              <FormField label="Grade" name="grade" defaultValue={user?.studentProfile?.grade || ''} placeholder="Grade 11" required />
              <FormField label="Curriculum" name="curriculum" defaultValue={user?.studentProfile?.curriculum || ''} placeholder="CAPS" required />
              <FormField
                label="How did you hear about us?"
                name="discoverySource"
                defaultValue={user?.studentProfile?.discoverySource || ''}
                placeholder="Instagram"
                required
              />
              <div className="md:col-span-3">
                <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Save student profile</button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Payment methods (Paystack)">
            <div className="space-y-4">
              <button
                type="button"
                onClick={addCard}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand/90 transition-colors"
              >
                Add a Card
              </button>
              <p className="text-sm text-zinc-400">
                Click "Add a Card" to securely authorize your card through Paystack for future payments.
              </p>
            </div>

            <div className="mt-4">
              <CardList cards={user?.paymentMethods || []} onSetDefault={handleSetDefault} onRemove={handleRemoveCard} />
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Tutor setup" subtitle={tutorStatus.message}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveTutorProfile}>
            <FormField
              label="Highest grade result file URL"
              name="highestGradeResultUrl"
              defaultValue={user?.tutorProfile?.highestGradeResultUrl || ''}
              placeholder="https://..."
              required
            />
            <FormField label="Math score %" name="mathScore" type="number" defaultValue={user?.tutorProfile?.mathScore ?? ''} required />
            <FormField
              label="Grades to tutor (comma separated)"
              name="gradesToTutor"
              defaultValue={(user?.tutorProfile?.gradesToTutor || []).join(', ')}
              placeholder="Grade 8, Grade 9"
              required
            />
            <FormField
              label="Math topics (comma separated)"
              name="topics"
              defaultValue={(user?.tutorProfile?.topics || []).join(', ')}
              placeholder="Algebra, Trigonometry"
              required
            />
            <FormField label="Bank name" name="bankName" defaultValue={user?.tutorProfile?.payout?.bankName || ''} required />
            <FormField label="Account number" name="accountNumber" defaultValue={user?.tutorProfile?.payout?.accountNumber || ''} required />
            <FormField label="Account holder" name="accountHolder" defaultValue={user?.tutorProfile?.payout?.accountHolder || ''} required />
            <FormField label="Profile photo URL" name="profilePhoto" defaultValue={user?.profilePhoto || ''} placeholder="https://..." required />
            <div className="md:col-span-2">
              <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Save tutor profile</button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
