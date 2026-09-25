import { useEffect, useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Button, ErrorNote, Field, Label, Small } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useToast } from '@/state/toast';
import { colors, space } from '@/theme';

interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
}

function ProfileForm() {
  const auth = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useResource<Profile & { profile?: Profile }>('/api/account/profile');
  const [form, setForm] = useState<Profile>({ firstName: '', lastName: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const p = data?.profile ?? data;
    if (p) setForm({ firstName: p.firstName ?? '', lastName: p.lastName ?? '', phone: p.phone ?? '' });
  }, [data]);

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      await api('/api/account/profile', { method: 'PUT', body: form });
      if (auth.user) auth.setUser({ ...auth.user, firstName: form.firstName, lastName: form.lastName });
      toast('Profile saved');
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PendingBlock pending={loading && !data} label="Loading profile" />
      {error && !data ? <ErrorNote message={error} onRetry={reload} /> : null}
      <Label style={{ color: colors.inkSoft }}>Email</Label>
      <Small style={{ marginBottom: space.lg, marginTop: space.xxs, color: colors.ink }}>{auth.user?.email}</Small>
      <Field label="First name" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} autoComplete="given-name" />
      <Field label="Last name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} autoComplete="family-name" />
      <Field label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" autoComplete="tel" />
      {saveError ? <ErrorNote message={saveError} /> : null}
      <Button title="Save" onPress={save} loading={busy} />
    </Screen>
  );
}

export default function ProfileScreen() {
  return (
    <AuthGate>
      <ProfileForm />
    </AuthGate>
  );
}
