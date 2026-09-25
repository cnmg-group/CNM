import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Body, Button, ErrorNote, Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

export default function ResetScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Body>If an account exists for {email.trim()}, we’ve emailed a link to reset your password. The link opens on the CNM website.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Body style={{ color: colors.inkSoft, marginBottom: space.lg }}>Enter your email and we’ll send you a reset link.</Body>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={submit} />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Send reset link" onPress={submit} loading={busy} />
    </Screen>
  );
}
