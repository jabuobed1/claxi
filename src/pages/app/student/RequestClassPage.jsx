import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import FormField from '../../../components/ui/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { createClassRequest } from '../../../services/classRequestService';

const initialForm = {
  subject: '',
  topic: '',
  description: '',
  preferredDate: '',
  preferredTime: '',
  duration: '60 mins',
  tutorPreference: '',
  budget: '',
};

export default function RequestClassPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      await createClassRequest({
        ...form,
        mode: 'online',
        studentId: user.uid,
        studentName: user.displayName || user.email,
      });
      navigate('/app/student/requests');
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to submit request right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Request a Class" description="Fill in details and tutors will receive this request in real time." />

      <SectionCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Subject" name="subject" value={form.subject} onChange={onChange} placeholder="Mathematics" required />
            <FormField label="Topic / Title" name="topic" value={form.topic} onChange={onChange} placeholder="Derivatives and limits" required />
          </div>

          <FormField
            label="Description"
            as="textarea"
            rows={4}
            name="description"
            value={form.description}
            onChange={onChange}
            placeholder="Share your goals, pain points, and specific chapters."
            required
          />

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Preferred date" name="preferredDate" type="date" value={form.preferredDate} onChange={onChange} required />
            <FormField label="Preferred time" name="preferredTime" type="time" value={form.preferredTime} onChange={onChange} required />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <FormField label="Duration" name="duration" value={form.duration} onChange={onChange} placeholder="60 mins" required />
            <FormField label="Mode" name="modeDisplay" value="Online" readOnly className="bg-zinc-900 text-zinc-400" />
            <FormField label="Budget (optional)" name="budget" value={form.budget} onChange={onChange} placeholder="$20-40/hr" />
          </div>

          <FormField
            label="Tutor preference (optional)"
            name="tutorPreference"
            value={form.tutorPreference}
            onChange={onChange}
            placeholder="Preferred tutor name or expertise"
          />

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {isSaving ? 'Submitting...' : 'Post Request'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
