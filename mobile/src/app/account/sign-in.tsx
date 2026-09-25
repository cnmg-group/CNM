import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, ErrorNote, Field, TextLink } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Body style={{ color: colors.inkSoft, marginBottom: space.lg }}>Sign in to your CNM Essentials account.</Body>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" returnKeyType="next" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      {error ? <ErrorNote message={error} /> : null}
      <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
      <View style={{ marginTop: space.lg, gap: space.xxs }}>
        <TextLink title="Forgotten password?" onPress={() => router.replace('/account/reset')} />
        <TextLink title="Email me a sign-in code instead" onPress={() => router.replace('/account/otp')} />
        <TextLink title="Create an account" onPress={() => router.replace('/account/register')} />
      </View>
    </Screen>
  );
}
