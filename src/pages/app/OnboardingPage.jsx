import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/userService';
import { removePaymentMethod, setDefaultPaymentMethod } from '../../services/paymentMethodService';
import { initializeCardAuthorization, verifyCardAuthorization } from '../../services/paystackService';
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
  const [isAuthorizingCard, setIsAuthorizingCard] = useState(false);

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
    setIsAuthorizingCard(true);

    try {
      await initializeCardAuthorization({
        email: user.email,
        onSuccess: async (response) => {
          try {
            const result = await verifyCardAuthorization(response.reference);
            setUser((prev) => {
              const existingMethods = Array.isArray(prev?.paymentMethods) ? prev.paymentMethods : [];
              const alreadyExists = existingMethods.some((method) => method.id === result.card.id);
              return {
                ...prev,
                paymentMethods: alreadyExists ? existingMethods : [...existingMethods, result.card],
              };
            });

            setStatusMessage(
              result.refunded
                ? `Card ending in ${result.card.last4} added successfully. Your R1 authorization has been refunded.`
                : result.refundMessage || `Card ending in ${result.card.last4} was added. Refund is still processing.`,
            );
          } catch (error) {
            setStatusMessage(error.message || 'We could not verify and save this card. Please try again.');
          } finally {
            setIsAuthorizingCard(false);
          }
        },
        onClose: () => {
          setStatusMessage('Card authorization cancelled.');
          setIsAuthorizingCard(false);
        },
      });
    } catch (error) {
      setStatusMessage(`Failed to initialize payment: ${error.message}`);
      setIsAuthorizingCard(false);
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
                disabled={isAuthorizingCard}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAuthorizingCard ? 'Authorizing card…' : 'Add a Card'}
              </button>
              <p className="text-sm text-zinc-400">
                We charge R1 to securely authorize your card, then immediately refund it after verification.
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
