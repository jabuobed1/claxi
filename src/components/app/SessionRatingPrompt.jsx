import { useMemo, useState } from 'react';
import SelectField from '../ui/SelectField';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { submitSessionRating } from '../../services/sessionService';

export default function SessionRatingPrompt() {
  const { user } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(role === 'student' ? user?.uid : null);
  const { sessions: tutorSessions } = useTutorSessions(role === 'tutor' ? user?.uid : null);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const target = useMemo(
    () => sessions.find((item) => item.status === 'completed' && !item?.ratings?.[role]),
    [sessions, role],
  );

  const [form, setForm] = useState({ overall: '5', topic: '5', comment: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [dismissedId, setDismissedId] = useState('');

  if (!target || dismissedId === target.id) return null;

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await submitSessionRating(target, role, {
        overall: Number(form.overall),
        topic: Number(form.topic),
        comment: form.comment,
      });
      setDismissedId('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-zinc-950/90 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Session completed</p>
            <h3 className="text-2xl font-black text-zinc-900">Rate this session</h3>
          </div>
          <button type="button" onClick={() => setDismissedId(target.id)} className="rounded-xl border border-zinc-300 px-3 py-1 text-xs font-semibold">Close</button>
        </div>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <SelectField
            label="Overall"
            name="overall"
            value={form.overall}
            onChange={(event) => setForm((prev) => ({ ...prev, overall: event.target.value }))}
            options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}/5` }))}
          />
          <SelectField
            label="Topic specific"
            name="topic"
            value={form.topic}
            onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
            options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}/5` }))}
          />
          <div className="md:col-span-2">
            <textarea
              value={form.comment}
              onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Optional feedback"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {isSaving ? 'Saving...' : 'Submit rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
