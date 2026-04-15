import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import StudentTopNav from '../../../components/app/student/StudentTopNav';
import StudentRequestInputPanel from '../../../components/app/student/StudentRequestInputPanel';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { createClassRequest } from '../../../services/classRequestService';
import { uploadUserFile } from '../../../services/storageService';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { DEFAULT_LESSON_DURATION, formatRand } from '../../../utils/pricing';
import { fetchPricingQuote } from '../../../services/pricingService';
import { estimateFreeMinutePricing } from '../../../services/studentGrowthService';

const STUDENT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2000&q=80';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [topic, setTopic] = useState('');
  const [cardId, setCardId] = useState(
    user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || ''
  );
  const [attachments, setAttachments] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [quote, setQuote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { requests } = useStudentRequests(user?.uid);

  const onboardingStatus = getStudentOnboardingStatus(user);
  const hasRequestContent = Boolean(topic.trim()) || attachments.length > 0;
  const canSend = onboardingStatus.complete && hasRequestContent && Boolean(cardId);
  const activeOrOngoingRequest = requests.find((request) =>
    [
      REQUEST_STATUSES.PENDING,
      REQUEST_STATUSES.MATCHING,
      REQUEST_STATUSES.OFFERED,
      REQUEST_STATUSES.ACCEPTED,
      REQUEST_STATUSES.WAITING_STUDENT,
      REQUEST_STATUSES.IN_PROGRESS,
      REQUEST_STATUSES.IN_SESSION,
      REQUEST_STATUSES.NO_TUTOR_AVAILABLE,
    ].includes(request.status),
  );
  const latestRequest = requests[0] || null;
  const pricingPreview = quote
    ? estimateFreeMinutePricing({
        originalPrice: quote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining: user?.freeMinutesRemaining || 0,
      })
    : null;

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  };

  const onTopicChange = (event) => {
    setTopic(event.target.value);
    resizeTextarea();
  };

  const refreshQuote = async (minutes) => {
    const nextQuote = await fetchPricingQuote({
      durationMinutes: minutes,
      subject: 'Mathematics',
    });
    setQuote(nextQuote);
    return nextQuote;
  };

  const onFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((file) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      return isImage || isPdf;
    });

    if (!validFiles.length) return;

    setAttachments((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const newFiles = validFiles.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
      );
      return [...prev, ...newFiles];
    });

    event.target.value = '';
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const goToRequestStatus = async () => {
    if (!canSend || isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const activeQuote = quote || (await refreshQuote(durationMinutes));
      const activePricingPreview = estimateFreeMinutePricing({
        originalPrice: activeQuote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining: user?.freeMinutesRemaining || 0,
      });
      const quoteWithDiscount = {
        ...activeQuote,
        originalPrice: activePricingPreview.originalPrice,
        discountApplied: activePricingPreview.discountApplied,
        finalPrice: activePricingPreview.finalPrice,
        discountSource: activePricingPreview.discountSource,
        freeMinutesApplied: activePricingPreview.freeMinutesApplied,
        requestedDurationMinutes: durationMinutes,
      };
      const requestText =
        topic.trim() || `Help me with attached file${attachments.length > 1 ? 's' : ''}: ${attachments.map((file) => file.name).join(', ')}`;

      let uploadedAttachments = [];

      if (attachments.length) {
        uploadedAttachments = await Promise.all(
          attachments.map(async (file) => {
            const uploadResult = await uploadUserFile({
              userId: user.uid,
              file,
              pathPrefix: 'request-attachments',
            });

            return {
              fileName: file.name,
              contentType: file.type || '',
              size: Number(file.size || 0),
              path: uploadResult.objectPath,
              downloadUrl: uploadResult.downloadUrl,
            };
          })
        );
      }

      const requestId = await createClassRequest({
        topic: requestText,
        description: topic.trim(),
        preferredDate: '',
        preferredTime: '',
        duration: `${durationMinutes} minutes`,
        durationMinutes,
        meetingProviderPreference: 'any',
        mode: 'online',
        imageAttachment: uploadedAttachments.map((file) => file.fileName).join(', '),
        attachment: uploadedAttachments[0] || null,
        attachments: uploadedAttachments,
        studentId: user.uid,
        studentName: user.fullName || user.displayName || user.email,
        studentEmail: user.email,
        selectedCardId: cardId,
        pricingSnapshot: quoteWithDiscount,
      });

      navigate(`/app/student/request/${requestId}`, {
        state: {
          requestId,
          topic: requestText,
        },
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit request right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = user?.fullName || user?.displayName || 'Student';

  useEffect(() => {
    if (!onboardingStatus.complete) return;
    refreshQuote(durationMinutes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStatus.complete]);

  const handleDurationChange = async (event) => {
    const minutes = Number(event.target.value || DEFAULT_LESSON_DURATION);
    setDurationMinutes(minutes);
    setError('');
    try {
      await refreshQuote(minutes);
    } catch (quoteError) {
      setError(quoteError.message || 'Unable to refresh pricing quote.');
    }
  };

  return (
    <div className="relative -mx-4 -mt-4 flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-zinc-950 md:-mx-6 md:-mt-6 md:min-h-[calc(100vh-5rem)]">
      <img
        src={STUDENT_HERO_IMAGE}
        alt="Student learning environment"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/85" />

      <StudentTopNav displayName={displayName} />

      <div className="relative z-10 mt-auto px-4 pb-5 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {!onboardingStatus.complete ? (
            <div className="mb-3 rounded-2xl border border-amber-200/20 bg-black/35 p-3 text-sm text-amber-100 backdrop-blur-xl">
              <OnboardingStatusBanner user={user} role="student" />
              <p className="mt-2">{onboardingStatus.message}</p>
              <Link
                to="/app/onboarding?role=student"
                className="mt-3 inline-flex rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Complete profile
              </Link>
            </div>
          ) : null}

          <div className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
            Student Request
          </div>

          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Request a tutor instantly with Claxi
          </h1>

          <p className="mt-2 text-sm text-zinc-200/90">Hi {displayName}. Ask a question, attach your work, and continue in one step.</p>

          <div className="mt-4 space-y-3">
            <StudentRequestInputPanel
              topic={topic}
              onTopicChange={onTopicChange}
              textareaRef={textareaRef}
              attachments={attachments}
              onFileChange={onFileChange}
              onRemoveAttachment={removeAttachment}
              durationMinutes={durationMinutes}
              onDurationChange={handleDurationChange}
              cardId={cardId}
              onCardChange={setCardId}
              paymentMethods={user?.paymentMethods || []}
            />

            {activeOrOngoingRequest || latestRequest ? (
              <div className="rounded-2xl border border-white/15 bg-black/30 p-3 text-xs text-zinc-200 backdrop-blur-xl">
                {activeOrOngoingRequest ? (
                  <p>
                    Active request:{' '}
                    <span className="font-semibold text-white">{activeOrOngoingRequest.topic || 'Mathematics request'}</span>.
                    <Link to={`/app/student/request/${activeOrOngoingRequest.id}`} className="ml-1 underline underline-offset-2 text-emerald-300">Open status</Link>
                  </p>
                ) : null}
                {!activeOrOngoingRequest && latestRequest ? (
                  <p>
                    Last request:{' '}
                    <span className="font-semibold text-white">{latestRequest.topic || 'Mathematics request'}</span>.
                    <Link to={`/app/student/requests/${latestRequest.id}`} className="ml-1 underline underline-offset-2 text-emerald-300">View details</Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={goToRequestStatus}
              disabled={!canSend || isSubmitting}
              className={`inline-flex min-h-14 w-full flex-col items-center justify-center rounded-2xl px-4 py-2 text-white shadow-lg transition ${
                canSend
                  ? 'bg-[#10B981] hover:bg-emerald-500'
                  : 'bg-zinc-500/80'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-base font-bold">
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Requesting...' : 'Continue'}
              </span>
              <span className="mt-0.5 text-xs text-white/90">
                Estimated price:{' '}
                {pricingPreview
                  ? formatRand(pricingPreview.finalPrice)
                  : quote
                    ? formatRand(quote.totalAmount)
                    : '...'}
              </span>
            </button>

            {quote && pricingPreview ? (
              <p className="text-xs text-zinc-300">
                Original {formatRand(pricingPreview.originalPrice)} • Free-minute discount {formatRand(pricingPreview.discountApplied)} ({pricingPreview.freeMinutesApplied.toFixed(2)} min)
              </p>
            ) : null}

            <p className="text-xs text-zinc-300">
              Free minutes balance: {Number(user?.freeMinutesRemaining || 0).toFixed(2)} min • Referral code: {user?.referralCode || 'Loading...'}
            </p>

            {!user?.paymentMethods?.length ? (
              <p className="text-xs text-amber-300">Add a payment card from Payment page first.</p>
            ) : null}

            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
