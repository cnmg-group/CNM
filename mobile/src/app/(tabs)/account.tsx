import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LockScreen } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Body, Button, H1, Label, Small } from '@/components/ui';
import { APP_VERSION, IS_STAGING } from '@/lib/config';
import { openWebPage } from '@/lib/web';
import { useAuth } from '@/state/auth';
import { colors, hairline, minTouch, space, type } from '@/theme';

function MenuRow({ label, icon, onPress, external }: { label: string; icon: ComponentProps<typeof Feather>['name']; onPress: () => void; external?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cream }]}
    >
      <Feather name={icon} size={18} color={colors.ink} />
      <Text style={[type.body, { flex: 1, marginLeft: space.md }]}>{label}</Text>
      <Feather name={external ? 'arrow-up-right' : 'chevron-right'} size={18} color={colors.muted} />
    </Pressable>
  );
}

function HelpLinks() {
  return (
    <View style={{ marginTop: space.xl }}>
      <Label style={{ marginBottom: space.xs }}>Help</Label>
      <MenuRow label="Delivery & returns" icon="truck" external onPress={() => openWebPage('/delivery-returns/')} />
      <MenuRow label="FAQs" icon="help-circle" external onPress={() => openWebPage('/faqs/')} />
      <MenuRow label="Stores" icon="map-pin" external onPress={() => openWebPage('/stores/')} />
      <MenuRow label="Contact" icon="mail" external onPress={() => openWebPage('/contact/')} />
      <MenuRow label="Privacy policy" icon="shield" external onPress={() => openWebPage('/privacy/')} />
      <MenuRow label="Terms" icon="file-text" external onPress={() => openWebPage('/terms/')} />
      <Small style={{ marginTop: space.lg, color: colors.muted }}>
        Version {APP_VERSION}
        {IS_STAGING ? ' · staging' : ''}
      </Small>
    </View>
  );
}

export default function AccountScreen() {
  const auth = useAuth();

  if (auth.status === 'restoring') return <PendingBlock pending label="Loading your account" />;
  if (auth.status === 'signedIn' && auth.locked) return <LockScreen />;

  if (auth.status === 'signedOut') {
    return (
      <Screen>
        <H1>Welcome</H1>
        <Body style={{ color: colors.inkSoft, marginTop: space.sm }}>Sign in to track orders, save addresses and keep your wishlist across devices.</Body>
        <Button title="Sign in" onPress={() => router.push('/account/sign-in')} style={{ marginTop: space.lg }} />
        <Button title="Create account" variant="secondary" onPress={() => router.push('/account/register')} style={{ marginTop: space.sm }} />
        <Button title="Email me a sign-in code" variant="ghost" onPress={() => router.push('/account/otp')} style={{ marginTop: space.xs }} />
        <HelpLinks />
      </Screen>
    );
  }

  return (
    <Screen>
      <Label style={{ color: colors.muted }}>Signed in as {auth.user?.email}</Label>
      <H1 style={{ marginTop: space.xs, marginBottom: space.lg }}>Hello{auth.user?.firstName ? `, ${auth.user.firstName}` : ''}.</H1>
      <MenuRow label="Orders" icon="package" onPress={() => router.push('/account/orders')} />
      <MenuRow label="Profile" icon="user" onPress={() => router.push('/account/profile')} />
      <MenuRow label="Addresses" icon="map" onPress={() => router.push('/account/addresses')} />
      <MenuRow label="Notifications" icon="bell" onPress={() => router.push('/account/preferences')} />
      <MenuRow label="Privacy & security" icon="lock" onPress={() => router.push('/account/security')} />
      <Button title="Sign out" variant="secondary" onPress={() => auth.signOut()} style={{ marginTop: space.lg }} />
      <HelpLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouch + 12, borderBottomWidth: hairline, borderColor: colors.hairline },
});
