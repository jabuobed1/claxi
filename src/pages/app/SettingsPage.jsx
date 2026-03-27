import { useEffect, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import { useAuth } from '../../hooks/useAuth';
import { getUserProfile, updateUserProfile } from '../../services/userService';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    subjects: '',
    availability: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    getUserProfile(user.uid).then((profile) => {
      const profileData = profile || user;
      setForm({
        fullName: profileData.fullName || profileData.displayName || '',
        phoneNumber: profileData.phoneNumber || '',
        bio: profileData.bio || '',
        subjects: (profileData.subjects || []).join(', '),
        availability: profileData.availability || '',
      });
    });
  }, [user]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!user?.uid) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    const profile = await updateUserProfile(user.uid, {
      fullName: form.fullName,
      displayName: form.fullName,
      phoneNumber: form.phoneNumber,
      bio: form.bio,
      availability: form.availability,
      subjects: form.subjects
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });

    setUser((prev) => ({ ...prev, ...profile }));
    setMessage('Profile settings saved.');
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage account details and tutor profile preferences." />

      <SectionCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full name" name="fullName" value={form.fullName} onChange={onChange} required />
            <FormField label="Phone number" name="phoneNumber" value={form.phoneNumber} onChange={onChange} />
          </div>
          <FormField label="Bio" name="bio" as="textarea" rows={3} value={form.bio} onChange={onChange} />
          {user?.role === 'tutor' ? (
            <>
              <FormField
                label="Subjects (comma separated)"
                name="subjects"
                value={form.subjects}
                onChange={onChange}
                placeholder="Math, Physics, SAT"
              />
              <FormField
                label="Availability"
                name="availability"
                value={form.availability}
                onChange={onChange}
                placeholder="Weekdays after 5pm UTC"
              />
            </>
          ) : null}

          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save settings'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
