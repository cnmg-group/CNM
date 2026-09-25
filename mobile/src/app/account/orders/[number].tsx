import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Body, Button, Divider, ErrorNote, H1, Label, Row, Small } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { findProduct } from '@/lib/catalogue';
import { formatDate, formatNaira, orderStatusLabel } from '@/lib/format';
import type { Order } from '@/lib/types';
import { useCatalogue } from '@/state/catalogue';
import { colors, space } from '@/theme';

const TIMELINE = ['pending_payment', 'paid', 'processing', 'dispatched', 'delivered'];

function OrderDetail({ number }: { number: string }) {
  const { catalogue } = useCatalogue();
  const { data, loading, error, reload } = useResource<{ order: Order }>(`/api/account/orders/${encodeURIComponent(number)}`);
  const order = data?.order;
  if (!order) {
    return (
      <Screen>
        <PendingBlock pending={loading} label="Loading order" />
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      </Screen>
    );
  }
  const lines = order.items ?? order.lines ?? [];
  const stepIndex = TIMELINE.indexOf(order.status);
  const deliveryFee = typeof order.delivery === 'number' ? order.delivery : order.delivery?.fee;
  const deliveryInfo = typeof order.delivery === 'object' ? order.delivery : undefined;

  return (
    <Screen>
      <Label style={{ color: colors.muted }}>{formatDate(order.createdAt)}</Label>
      <H1 style={{ marginTop: space.xs }}>{orderStatusLabel(order.status)}</H1>
      {stepIndex >= 0 ? (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: space.md }} accessible accessibilityLabel={`Progress: ${orderStatusLabel(order.status)}`}>
          {TIMELINE.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 2, backgroundColor: i <= stepIndex ? colors.green : colors.hairline }} />
          ))}
        </View>
      ) : null}

      <Divider style={{ marginVertical: space.lg }} />
      <Label style={{ marginBottom: space.sm }}>Items</Label>
      {lines.map((l) => {
        const p = findProduct(catalogue, l.id);
        return (
          <View key={l.id} style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Body style={{ flex: 1 }} onPress={p ? () => router.push(`/products/${p.slug}`) : undefined}>
              {l.name ?? p?.name ?? l.id} × {l.qty}
            </Body>
            {l.lineTotal != null ? <Body>{formatNaira(l.lineTotal)}</Body> : null}
          </View>
        );
      })}

      <Divider style={{ marginVertical: space.lg }} />
      {order.subtotal != null ? <Row label="Subtotal" value={formatNaira(order.subtotal)} /> : null}
      {order.discount ? <Row label="Discount" value={`−${formatNaira(order.discount)}`} /> : null}
      {deliveryFee != null ? <Row label="Delivery" value={deliveryFee ? formatNaira(deliveryFee) : 'Free'} /> : null}
      {order.vat != null ? <Row label="VAT" value={formatNaira(order.vat)} /> : null}
      <Row label="Total" value={formatNaira(order.total)} strong />

      {deliveryInfo ? (
        <>
          <Divider style={{ marginVertical: space.lg }} />
          <Label style={{ marginBottom: space.sm }}>Delivery</Label>
          {deliveryInfo.method ? <Body>{deliveryInfo.method}</Body> : null}
          {deliveryInfo.address ? <Small>{[deliveryInfo.address.line1, deliveryInfo.address.city, deliveryInfo.address.state].filter(Boolean).join(', ')}</Small> : null}
          {deliveryInfo.storeSlug ? <Small>Collect from {deliveryInfo.storeSlug}</Small> : null}
        </>
      ) : null}

      {order.history?.length ? (
        <>
          <Divider style={{ marginVertical: space.lg }} />
          <Label style={{ marginBottom: space.sm }}>History</Label>
          {order.history.map((h, i) => (
            <Small key={i}>
              {formatDate(h.at)} — {orderStatusLabel(h.status)}
              {h.note ? ` · ${h.note}` : ''}
            </Small>
          ))}
        </>
      ) : null}
      <Button title="Continue shopping" variant="secondary" onPress={() => router.push('/shop')} style={{ marginTop: space.xl }} />
    </Screen>
  );
}

export default function OrderScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  return (
    <>
      <Stack.Screen options={{ title: `Order ${number}` }} />
      <AuthGate message="Sign in to view this order.">
        <OrderDetail number={number} />
      </AuthGate>
    </>
  );
}
