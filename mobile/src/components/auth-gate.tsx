import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { biometricsAvailable } from '@/lib/biometrics';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

import { PendingBlock } from './butterfly-loader';
import { Body, Button, H1 } from './ui';

export function LockScreen() {
  const { unlock, signOut } = useAuth();
  const [label, setLabel] = useState('biometrics');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    biometricsAvailable().then((b) => setLabel(b.label));
  }, []);
  const tryUnlock = async () => setFailed(!(await unlock()));
  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.center}>
      <H1 style={{ textAlign: 'center' }}>Your account is locked</H1>
      <Body style={styles.body}>Unlock with {label} to see your orders, addresses and details.</Body>
      {failed ? <Body style={[styles.body, { color: colors.danger }]}>Couldn’t verify. Please try again.</Body> : null}
      <Button title={`Unlock with ${label}`} onPress={tryUnlock} style={styles.btn} />
      <Button title="Sign out" variant="ghost" onPress={() => signOut()} style={styles.btn} />
    </View>
  );
}

export function SignInPrompt({ message = 'Sign in to continue.' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <H1 style={{ textAlign: 'center' }}>Sign in</H1>
      <Body style={styles.body}>{message}</Body>
      <Button title="Sign in" onPress={() => router.push('/account/sign-in')} style={styles.btn} />
      <Button title="Create account" variant="secondary" onPress={() => router.push('/account/register')} style={styles.btn} />
    </View>
  );
}

/** Renders children only for a signed-in, unlocked session. */
export function AuthGate({ children, message }: { children: ReactNode; message?: string }) {
  const { status, locked } = useAuth();
  if (status === 'restoring') return <PendingBlock pending label="Loading your account" />;
  if (status === 'signedOut') return <SignInPrompt message={message} />;
  if (locked) return <LockScreen />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: space.lg, justifyContent: 'center', backgroundColor: colors.white },
  body: { textAlign: 'center', color: colors.inkSoft, marginTop: space.sm },
  btn: { marginTop: space.md, alignSelf: 'stretch' },
});
