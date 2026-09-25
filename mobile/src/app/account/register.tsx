import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Button, ErrorNote, Field, Small, ToggleRow } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { openWebPage } from '@/lib/web';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

const MIN_PASSWORD = 10;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, marketingOptIn });
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Field label="First name" value={form.firstName} onChangeText={set('firstName')} autoComplete="given-name" textContentType="givenName" error={errors.firstName} />
      <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} autoComplete="family-name" textContentType="familyName" error={errors.lastName} />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={errors.email} />
      <Field
        label="Password"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
        hint={`At least ${MIN_PASSWORD} characters`}
      />
      <ToggleRow label="Email me about new arrivals and events" description="You can change this any time in Notifications." value={marketingOptIn} onValueChange={setMarketingOptIn} />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: space.md }} />
      <Small style={{ marginTop: space.md, color: colors.muted }} onPress={() => openWebPage('/privacy/')} accessibilityRole="link">
        By creating an account you agree to our terms and privacy policy.
      </Small>
    </Screen>
  );
}
