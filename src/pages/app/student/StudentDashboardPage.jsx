import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, PlayCircle } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import StatCard from '../../../components/ui/StatCard';
import SectionCard from '../../../components/ui/SectionCard';
import RequestCard from '../../../components/app/RequestCard';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingState from '../../../components/ui/LoadingState';
import NotificationFeed from '../../../components/app/NotificationFeed';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { useStudentSessions } from '../../../hooks/useSessions';
import { useNotifications } from '../../../hooks/useNotifications';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';
import { createClassRequest } from '../../../services/classRequestService';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useStudentRequests(user?.uid);
  const { sessions } = useStudentSessions(user?.uid);
  const { notifications } = useNotifications(user?.uid);
  const [topic, setTopic] = useState('');
  const [imageAttachment, setImageAttachment] = useState('');
  const [isSending, setIsSending] = useState(false);

  const onboardingStatus = getStudentOnboardingStatus(user);
  const activeRequests = requests.filter((request) => ['pending', 'matching', 'offered', 'accepted', 'waiting_student', 'in_progress'].includes(request.status));
  const upcoming = sessions.filter((session) =>
    ['accepted', 'waiting_student', 'in_progress'].includes(session.status),
  );

  const quickRequest = async (event) => {
    event.preventDefault();
    if (!topic.trim() || !onboardingStatus.complete) {
      return;
    }

    setIsSending(true);
    try {
      await createClassRequest({
        topic: topic.trim(),
        description: topic.trim(),
        preferredDate: '',
        preferredTime: '',
        duration: 'Flexible',
        meetingProviderPreference: 'any',
        mode: 'online',
        imageAttachment,
        studentId: user.uid,
        studentName: user.fullName || user.displayName || user.email,
        studentEmail: user.email,
      });
      setTopic('');
      setImageAttachment('');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageAttachment(reader.result?.toString() || '');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Dashboard"
        description="Track your class requests in real time and launch sessions quickly."
        action={
          onboardingStatus.complete ? (
            <Link
              to="/app/student/request-class"
              className="inline-flex rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              Request New Class
            </Link>
          ) : (
            <Link
              to="/app/onboarding?role=student"
              className="inline-flex rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-200 transition hover:bg-amber-500/20"
            >
              Complete profile to request
            </Link>
          )
        }
      />

      <OnboardingStatusBanner user={user} role="student" />

      <SectionCard title="Need help right now?" subtitle="Enter the topic and we immediately notify online tutors.">
        <form className="space-y-3" onSubmit={quickRequest}>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What topic do you need help with?"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none focus:border-brand"
            disabled={!onboardingStatus.complete || isSending}
            required
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-2xl border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-200">
              Add photo
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            {imageAttachment ? <span className="text-xs text-emerald-300">Photo attached</span> : null}
            <button
              type="submit"
              disabled={!onboardingStatus.complete || isSending}
              className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSending ? 'Sending to tutors...' : 'Request now'}
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Requests" value={requests.length} icon={ClipboardList} />
        <StatCard title="Active Requests" value={activeRequests.length} icon={PlayCircle} tone="sky" />
        <StatCard title="Upcoming Sessions" value={upcoming.length} icon={CalendarClock} tone="zinc" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Latest activity" subtitle="Automatically synced using Firestore listeners.">
            {isLoading ? (
              <LoadingState message="Loading requests..." />
            ) : requests.length ? (
              <div className="space-y-4">
                {requests.slice(0, 3).map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No class requests yet"
                description="Create your first class request and tutors will see it instantly."
              />
            )}
          </SectionCard>
        </div>

        <SectionCard title="Notifications" subtitle="Instant updates for accepts and scheduling.">
          <NotificationFeed notifications={notifications} />
        </SectionCard>
      </div>
    </div>
  );
}
