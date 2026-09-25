import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Body, Button, ErrorNote, Field, TextLink } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

export default function OtpScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await requestOtp(email);
      setStage('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code.');
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {stage === 'email' ? (
        <>
          <Body style={{ color: colors.inkSoft, marginBottom: space.lg }}>We’ll email you a 6-digit code to sign in — no password needed.</Body>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={send} />
          {error ? <ErrorNote message={error} /> : null}
          <Button title="Send code" onPress={send} loading={busy} />
        </>
      ) : (
        <>
          <Body style={{ color: colors.inkSoft, marginBottom: space.lg }}>Enter the code we sent to {email.trim()}. It expires in 10 minutes.</Body>
          <Field
            label="6-digit code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            onSubmitEditing={verify}
          />
          {error ? <ErrorNote message={error} /> : null}
          <Button title="Sign in" onPress={verify} loading={busy} />
          <TextLink title="Send a new code" onPress={send} style={{ marginTop: space.md }} />
        </>
      )}
    </Screen>
  );
}
