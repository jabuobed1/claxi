import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Paperclip, Send } from 'lucide-react';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import { useAuth } from '../../../hooks/useAuth';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';
import { getLessonPrice, LESSON_DURATION_OPTIONS } from '../../../utils/pricing';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [topic, setTopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [cardId, setCardId] = useState(user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '');
  const [attachment, setAttachment] = useState(null);

  const onboardingStatus = getStudentOnboardingStatus(user);
  const selectedPrice = getLessonPrice(durationMinutes);
  const canSend = onboardingStatus.complete && Boolean(topic.trim()) && Boolean(cardId) && Boolean(durationMinutes);

  const onTopicChange = (event) => {
    setTopic(event.target.value);
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) return;
    setAttachment(file);
  };

  const goToRequestStatus = () => {
    if (!canSend) return;

    navigate('/app/student/request', {
      state: {
        topic: topic.trim(),
        description: topic.trim(),
        durationMinutes,
        cardId,
        attachment,
      },
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-13rem)] flex-col overflow-hidden">
      {!onboardingStatus.complete ? (
        <div className="mb-4">
          <OnboardingStatusBanner user={user} role="student" />
          <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{onboardingStatus.message}</p>
            <Link to="/app/onboarding?role=student" className="mt-2 inline-flex rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">
              Complete profile
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <textarea
            ref={textareaRef}
            value={topic}
            onChange={onTopicChange}
            placeholder="What do you want to learn today?"
            rows={3}
            className="max-h-[220px] min-h-[92px] w-full resize-none overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-brand"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-zinc-700 hover:bg-zinc-50">
              <Paperclip className="h-4 w-4" />
              <span className="text-xs font-semibold">+</span>
              <input type="file" accept="application/pdf,image/*" onChange={onFileChange} className="hidden" />
            </label>

            <select
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700"
            >
              <option value="">Select card</option>
              {(user?.paymentMethods || []).map((card) => (
                <option key={card.id} value={card.id}>
                  {card.nickname} •••• {card.last4} {card.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>

            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700"
            >
              {LESSON_DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={goToRequestStatus}
              disabled={!canSend}
              className={`ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${canSend ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-300'}`}
            >
              <Send className="h-3.5 w-3.5" />
              Request • R{selectedPrice}
            </button>
          </div>

          {attachment ? <p className="mt-2 text-xs text-emerald-700">Attached: {attachment.name}</p> : null}
          {!user?.paymentMethods?.length ? <p className="mt-2 text-xs text-amber-700">Add a payment card from Payment page first.</p> : null}
        </div>
      </div>
    </div>
  );
}
