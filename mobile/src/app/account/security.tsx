import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { Screen } from '@/components/screen';
import { Button, Divider, H2, Small, ToggleRow } from '@/components/ui';
import { biometricsAvailable } from '@/lib/biometrics';
import { useAuth } from '@/state/auth';
import { colors, space } from '@/theme';

function SecurityForm() {
  const auth = useAuth();
  const [bio, setBio] = useState<{ available: boolean; label: string }>({ available: false, label: 'biometrics' });
  useEffect(() => {
    biometricsAvailable().then(setBio);
  }, []);

  return (
    <Screen>
      <H2>App lock</H2>
      <Divider style={{ marginTop: space.sm }} />
      <ToggleRow
        label={`Require ${bio.label} to open your account`}
        description={bio.available ? 'Your account stays hidden until you unlock it each time the app starts.' : 'Set up Face ID, Touch ID or fingerprint on this device to use this.'}
        value={auth.biometricEnabled}
        disabled={!bio.available}
        onValueChange={(v) => auth.setBiometricEnabled(v)}
      />
      <H2 style={{ marginTop: space.xl }}>Sessions</H2>
      <Small style={{ color: colors.inkSoft, marginTop: space.xs }}>Signs you out on every device, including the website.</Small>
      <Button
        title="Sign out everywhere"
        variant="danger"
        style={{ marginTop: space.md }}
        onPress={() =>
          Alert.alert('Sign out everywhere?', 'You will need to sign in again on all devices.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign out',
              style: 'destructive',
              onPress: async () => {
                await auth.signOut({ everywhere: true });
                router.replace('/account');
              },
            },
          ])
        }
      />
    </Screen>
  );
}

export default function SecurityScreen() {
  return (
    <AuthGate>
      <SecurityForm />
    </AuthGate>
  );
}
