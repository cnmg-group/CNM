import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Body, Button, H1, Label } from '@/components/ui';
import { track } from '@/lib/analytics';
import { errorMessage } from '@/lib/api';
import { verifyPayment, type VerifyResult } from '@/lib/payments';
import { useBag } from '@/state/bag';
import { colors, space } from '@/theme';

/**
 * Fallback landing for cnm://checkout/return?reference=… — used when the OS
 * delivers the Paystack redirect as a deep link instead of to the auth session.
 * The server verify call is idempotent, so double handling is safe.
 */
export default function PaymentReturnScreen() {
  const params = useLocalSearchParams<{ reference?: string; trxref?: string }>();
  const reference = params.reference ?? params.trxref;
  const bag = useBag();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(!!reference);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    verifyPayment(reference)
      .then((r) => {
        if (!active) return;
        setResult(r);
        if (r.paid) {
          track('purchase', { transaction_id: r.order?.number ?? reference, currency: 'NGN', value: r.order?.total });
          bag.clear();
        }
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setPending(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  return (
    <Screen>
      <PendingBlock pending={pending} message="Confirming your payment…" />
      {!pending && result?.paid ? (
        <>
          <Label style={{ color: colors.charcoal }}>Payment received</Label>
          <H1 style={{ marginTop: space.sm }}>Thank you.</H1>
          <Body style={{ marginTop: space.sm }}>{result.order?.number ? `Order ${result.order.number} is confirmed.` : 'Your order is confirmed.'}</Body>
          <Button title="Continue shopping" onPress={() => router.replace('/')} style={{ marginTop: space.xl }} />
        </>
      ) : null}
      {!pending && (!reference || error || (result && !result.paid)) ? (
        <>
          <H1>Payment not confirmed</H1>
          <Body style={{ marginTop: space.sm }}>{error ?? result?.message ?? 'We couldn’t confirm this payment. Your bag has been kept.'}</Body>
          <Button title="Back to bag" onPress={() => router.replace('/bag')} style={{ marginTop: space.xl }} />
        </>
      ) : null}
    </Screen>
  );
}
