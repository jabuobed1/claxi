import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../hooks/useClassRequests';
import { acceptClassRequest, declineClassRequest } from '../../services/classRequestService';
import { getTutorOnboardingStatus } from '../../utils/onboarding';
import { createZoomMeetingForRequest } from '../../services/zoomService';

export default function TutorOfferOverlay() {
  const { user } = useAuth();
  const { requests } = useTutorAvailableRequests(user?.uid);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const canAccept = onboardingStatus.complete && user?.onlineStatus === 'online';
  const [activeRequest, setActiveRequest] = useState(null);
  const [now, setNow] = useState(Date.now());
  const audioCtxRef = useRef(null);
  const latestRequestIdRef = useRef(null);

  const topRequest = requests[0] || null;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!topRequest?.id || latestRequestIdRef.current === topRequest.id) return;
    latestRequestIdRef.current = topRequest.id;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new window.AudioContext();
    }

    const ctx = audioCtxRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.05;

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  }, [topRequest?.id]);

  const secondsLeft = Math.max(0, Math.ceil(((topRequest?.offerExpiresAt || 0) - now) / 1000));
  const progress = useMemo(() => {
    const total = 30;
    return Math.max(0, Math.min(100, (secondsLeft / total) * 100));
  }, [secondsLeft]);

  const progressColor = progress > 60 ? 'bg-emerald-500' : progress > 30 ? 'bg-amber-500' : 'bg-rose-500';

  const handleResponse = async (response) => {
    if (!topRequest || !canAccept) return;
    setActiveRequest(topRequest.id);
    try {
      if (response === 'accept') {
        const meeting = await createZoomMeetingForRequest({
          requestId: topRequest.id,
          topic: topRequest.topic || 'Claxi session',
          durationMinutes: Number(topRequest.durationMinutes || topRequest.duration || 30),
        });
        await acceptClassRequest({
          requestId: topRequest.id,
          tutorId: user.uid,
          tutorName: user.fullName || user.displayName || user.email,
          tutorEmail: user.email,
          meeting,
        });
      } else {
        await declineClassRequest({
          requestId: topRequest.id,
          tutorId: user.uid,
        });
      }
    } finally {
      setActiveRequest(null);
    }
  };

  if (!topRequest) return null;

  const isImage = topRequest.attachment?.contentType?.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/80 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-emerald-300 bg-white p-6 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Incoming request</p>
          <h3 className="text-lg font-bold text-zinc-900">{topRequest.topic || 'Mathematics request'}</h3>
          <p className="text-sm text-zinc-600">{topRequest.duration || 'N/A'} • {topRequest.subject || 'Mathematics'}</p>
        </div>
        <div className="min-w-[100px] text-right">
          <p className="text-xs font-semibold text-zinc-500">Time left</p>
          <p className="text-2xl font-black text-zinc-900">{secondsLeft}s</p>
        </div>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full ${progressColor} transition-all`} style={{ width: `${progress}%` }} />
      </div>

      <p className="mb-3 text-sm text-zinc-700">{topRequest.description || 'Student sent a request with attachment(s).'}</p>

      {topRequest.attachment?.downloadUrl ? (
        <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
          <p className="mb-2 font-semibold text-zinc-700">Attachment preview</p>
          {isImage ? (
            <img src={topRequest.attachment.downloadUrl} alt={topRequest.attachment.fileName || 'Attachment preview'} className="max-h-44 rounded-lg border border-zinc-200 object-contain" />
          ) : (
            <div className="flex items-center gap-2 text-zinc-700">
              {topRequest.attachment?.contentType?.includes('pdf') ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              <span>{topRequest.attachment.fileName || 'Document attachment'}</span>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleResponse('accept')}
          disabled={!canAccept || activeRequest === topRequest.id}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {activeRequest === topRequest.id ? 'Submitting...' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={() => handleResponse('decline')}
          disabled={!canAccept || activeRequest === topRequest.id}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
        >
          Decline
        </button>
      </div>
      </div>
    </div>
  );
}
