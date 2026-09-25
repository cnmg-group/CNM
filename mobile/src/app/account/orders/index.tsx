import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { EmptyState, ErrorNote, Label, Small } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { formatDate, formatNaira, orderStatusLabel } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';
import { colors, hairline, space, type } from '@/theme';

function OrderList() {
  const { data, loading, error, reload } = useResource<{ orders: OrderSummary[] }>('/api/account/orders');
  const orders = data?.orders ?? [];
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white, padding: space.md }}>
        <PendingBlock pending={loading} label="Loading orders" />
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      </View>
    );
  }
  return (
    <FlatList
      style={{ backgroundColor: colors.white }}
      data={orders}
      keyExtractor={(o) => o.number}
      onRefresh={reload}
      refreshing={loading && !!data}
      ListEmptyComponent={<EmptyState title="No orders yet" body="Your orders will appear here." action="Start shopping" onAction={() => router.push('/shop')} />}
      renderItem={({ item: o }) => (
        <Pressable
          onPress={() => router.push(`/account/orders/${o.number}`)}
          accessibilityRole="button"
          accessibilityLabel={`Order ${o.number}, ${orderStatusLabel(o.status)}, ${formatNaira(o.total)}`}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cream }]}
        >
          <View style={{ flex: 1 }}>
            <Label>{o.number}</Label>
            <Text style={[type.body, { marginTop: 2 }]}>{orderStatusLabel(o.status)}</Text>
            <Small>{[formatDate(o.createdAt), o.itemCount ? `${o.itemCount} item${o.itemCount === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</Small>
          </View>
          <Text style={type.price}>{formatNaira(o.total)}</Text>
          <Feather name="chevron-right" size={18} color={colors.muted} style={{ marginLeft: space.sm }} />
        </Pressable>
      )}
    />
  );
}

export default function OrdersScreen() {
  return (
    <AuthGate message="Sign in to see your orders.">
      <OrderList />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: hairline, borderColor: colors.hairline },
});
