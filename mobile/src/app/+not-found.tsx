import { Stack, router } from 'expo-router';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <EmptyState title="This page isn’t in the app" body="It may be available on the CNM website." action="Go to home" onAction={() => router.replace('/')} />
    </Screen>
  );
}
