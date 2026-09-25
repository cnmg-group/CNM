import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Body, Button, EmptyState, ErrorNote, Label, Small, TextLink } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { api, errorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';
import { colors, hairline, space } from '@/theme';

function AddressList() {
  const { data, setData, loading, error, reload } = useResource<{ addresses: Address[] }>('/api/account/addresses');
  const [saveError, setSaveError] = useState<string | null>(null);
  const addresses = data?.addresses ?? [];

  /** Optimistic write of the whole list (the API stores the list as one document). */
  const write = async (next: Address[]) => {
    const prev = addresses;
    setData({ addresses: next });
    setSaveError(null);
    try {
      await api('/api/account/addresses', { method: 'PUT', body: { addresses: next } });
    } catch (e) {
      setData({ addresses: prev });
      setSaveError(errorMessage(e));
    }
  };

  return (
    <Screen>
      <PendingBlock pending={loading && !data} label="Loading addresses" />
      {error && !data ? <ErrorNote message={error} onRetry={reload} /> : null}
      {saveError ? <ErrorNote message={saveError} /> : null}
      {data && !addresses.length ? <EmptyState title="No saved addresses" body="Save an address for faster checkout." /> : null}
      {addresses.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Label style={{ flex: 1 }}>{a.label || 'Address'}</Label>
            {a.isDefault ? <Label style={{ color: colors.green }}>Default</Label> : null}
          </View>
          <Body style={{ marginTop: space.xs }}>{`${a.firstName} ${a.lastName}`}</Body>
          <Small>{[a.line1, a.line2, a.city, a.state].filter(Boolean).join(', ')}</Small>
          {a.phone ? <Small>{a.phone}</Small> : null}
          <View style={styles.actions}>
            <TextLink title="Edit" onPress={() => router.push({ pathname: '/account/address-edit', params: { id: a.id } })} />
            {!a.isDefault ? <TextLink title="Make default" onPress={() => write(addresses.map((x) => ({ ...x, isDefault: x.id === a.id })))} /> : null}
            <TextLink
              title="Delete"
              onPress={() => {
                const next = addresses.filter((x) => x.id !== a.id);
                if (a.isDefault && next[0]) next[0] = { ...next[0], isDefault: true };
                write(next);
              }}
            />
          </View>
        </View>
      ))}
      <Button title="Add address" onPress={() => router.push('/account/address-edit')} style={{ marginTop: space.lg }} />
    </Screen>
  );
}

export default function AddressesScreen() {
  return (
    <AuthGate>
      <AddressList />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: hairline, borderColor: colors.hairline, paddingVertical: space.md },
  actions: { flexDirection: 'row', gap: space.lg },
});
