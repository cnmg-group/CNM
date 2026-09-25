import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ButterflyLoader, PendingBlock } from '@/components/butterfly-loader';
import { Screen } from '@/components/screen';
import { Totals } from '@/components/totals';
import { Body, Button, Divider, EmptyState, ErrorNote, Field, H1, H2, Label, Small, TextLink } from '@/components/ui';
import { useQuote } from '@/hooks/use-quote';
import { track } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { findProduct } from '@/lib/catalogue';
import { IS_STAGING } from '@/lib/config';
import { formatNaira } from '@/lib/format';
import { payWithPaystack, simulatePayment, type VerifyResult } from '@/lib/payments';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { Address, CheckoutResponse, DeliveryMethod } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { useBag } from '@/state/bag';
import { stores, useCatalogue } from '@/state/catalogue';
import { colors, hairline, minTouch, radius, space, type } from '@/theme';

type Step = 'contact' | 'delivery' | 'payment' | 'review' | 'paying' | 'confirmation' | 'failed';
const STEPS: { key: Step; label: string }[] = [
  { key: 'contact', label: 'Contact' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
];

interface Contact {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

type AddressDraft = Omit<Address, 'id' | 'label' | 'isDefault'>;
const EMPTY_ADDRESS: AddressDraft = { firstName: '', lastName: '', phone: '', line1: '', line2: '', city: '', state: '', country: 'NG' };

const PICKUP_ID = 'store-pickup';

function validateContact(c: Contact) {
  const e: Partial<Record<keyof Contact, string>> = {};
  if (!/\S+@\S+\.\S+/.test(c.email)) e.email = 'Enter a valid email address.';
  if (c.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a phone number we can reach you on.';
  if (!c.firstName.trim()) e.firstName = 'Required';
  if (!c.lastName.trim()) e.lastName = 'Required';
  return e;
}

function validateAddress(a: AddressDraft) {
  const e: Partial<Record<keyof AddressDraft, string>> = {};
  if (!a.line1.trim()) e.line1 = 'Required';
  if (!a.city.trim()) e.city = 'Required';
  if (!a.state.trim()) e.state = 'Required';
  return e;
}

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <View style={styles.stepper} accessibilityRole="progressbar" accessibilityLabel={idx >= 0 ? `Step ${idx + 1} of ${STEPS.length}: ${STEPS[idx].label}` : undefined}>
      {STEPS.map((s, i) => (
        <View key={s.key} style={[styles.stepItem, i <= idx && { borderColor: colors.charcoal }]}>
          <Label style={{ fontSize: 9, color: i <= idx ? colors.charcoal : colors.muted }}>{s.label}</Label>
        </View>
      ))}
    </View>
  );
}

function OptionRow({ selected, title, detail, onPress }: { selected: boolean; title: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      style={[styles.option, selected && { borderColor: colors.ink }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]} />
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{title}</Text>
        {detail ? <Small>{detail}</Small> : null}
      </View>
    </Pressable>
  );
}

export default function CheckoutScreen() {
  const { catalogue, commerce } = useCatalogue();
  const bag = useBag();
  const auth = useAuth();
  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState<Contact>({ email: '', phone: '', firstName: '', lastName: '' });
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof Contact, string>>>({});
  const [methodId, setMethodId] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof AddressDraft, string>>>({});
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(stores[0]?.slug ?? null);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [payResult, setPayResult] = useState<VerifyResult | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirmedLines, setConfirmedLines] = useState(bag.lines);

  const { quote, loading: quoting, error: quoteError, refetch } = useQuote(step === 'confirmation' ? [] : bag.lines, bag.promoCode, methodId);
  const methods: DeliveryMethod[] = quote?.deliveryMethods?.length ? quote.deliveryMethods : commerce.deliveryMethods;
  const method = methods.find((m) => m.id === methodId) ?? null;

  // Prefill contact from the signed-in user or the last guest checkout.
  useEffect(() => {
    (async () => {
      const saved = await readJSON<Contact | null>(KEYS.checkoutContact, null);
      setContact((c) => ({
        email: c.email || auth.user?.email || saved?.email || '',
        firstName: c.firstName || auth.user?.firstName || saved?.firstName || '',
        lastName: c.lastName || auth.user?.lastName || saved?.lastName || '',
        phone: c.phone || saved?.phone || '',
      }));
      if (auth.status === 'signedIn') {
        try {
          const res = await api<{ addresses: Address[] }>('/api/account/addresses');
          setSavedAddresses(res.addresses ?? []);
          const def = res.addresses?.find((a) => a.isDefault) ?? res.addresses?.[0];
          if (def) setAddress({ firstName: def.firstName, lastName: def.lastName, phone: def.phone, line1: def.line1, line2: def.line2 ?? '', city: def.city, state: def.state, country: def.country || 'NG' });
        } catch {
          // Addresses are a convenience; the form still works.
        }
      }
    })();
  }, [auth.status, auth.user]);

  const items = useMemo(() => bag.lines.map((l) => ({ id: l.id, qty: l.qty })), [bag.lines]);

  if (!bag.lines.length && step !== 'confirmation' && step !== 'paying' && step !== 'failed') {
    return (
      <Screen>
        <EmptyState title="Your bag is empty" action="Shop now" onAction={() => router.replace('/shop')} />
      </Screen>
    );
  }

  const goContactNext = () => {
    const e = validateContact(contact);
    setContactErrors(e);
    if (Object.keys(e).length) return;
    writeJSON(KEYS.checkoutContact, contact);
    setStep('delivery');
  };

  const goDeliveryNext = () => {
    if (!methodId) return;
    if (methodId !== PICKUP_ID) {
      const e = validateAddress(address);
      setAddressErrors(e);
      if (Object.keys(e).length) return;
    } else if (!storeSlug) return;
    track('add_shipping_info', { currency: 'NGN', shipping_tier: methodId });
    setStep('payment');
  };

  const handleResult = (r: VerifyResult, order: CheckoutResponse) => {
    setPayResult(r);
    if (r.paid) {
      setConfirmedLines(bag.lines);
      track('purchase', {
        transaction_id: order.order.number,
        currency: 'NGN',
        value: order.order.total,
        shipping: quote?.delivery,
        tax: quote?.vat,
        coupon: bag.promoCode ?? undefined,
        items: bag.lines.map((l) => ({ item_id: l.id, quantity: l.qty })),
      });
      bag.clear();
      setStep('confirmation');
    } else {
      track('payment_failed', { transaction_id: order.order.number, status: r.status });
      setStep('failed');
    }
  };

  const startPayment = async (res: CheckoutResponse) => {
    if (res.payment.mode === 'paystack' && res.payment.authorizationUrl) {
      setPaying(true);
      try {
        handleResult(await payWithPaystack(res.payment.authorizationUrl, res.payment.reference), res);
      } catch (e) {
        setPayResult({ paid: false, status: 'error', message: errorMessage(e) });
        setStep('failed');
      } finally {
        setPaying(false);
      }
    }
    // Simulated: the staging panel is rendered in the 'paying' step.
  };

  const placeOrder = async () => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await api<CheckoutResponse>('/api/checkout', {
        method: 'POST',
        timeoutMs: 30000,
        body: {
          items,
          contact: { ...contact, email: contact.email.trim() },
          delivery: methodId === PICKUP_ID ? { method: methodId, storeSlug } : { method: methodId, address },
          promoCode: bag.promoCode ?? undefined,
          notes: notes.trim() || undefined,
        },
      });
      setCheckout(res);
      track('add_payment_info', { currency: 'NGN', value: res.order.total, payment_type: res.payment.mode });
      setStep('paying');
      await startPayment(res);
    } catch (e) {
      setPlaceError(errorMessage(e));
    } finally {
      setPlacing(false);
    }
  };

  const simulate = async (outcome: 'success' | 'failure') => {
    if (!checkout) return;
    setPaying(true);
    try {
      handleResult(await simulatePayment(checkout.order.number, checkout.order.accessToken, outcome), checkout);
    } catch (e) {
      setPayResult({ paid: false, status: 'error', message: errorMessage(e) });
      setStep('failed');
    } finally {
      setPaying(false);
    }
  };

  const retryPayment = async () => {
    if (!checkout) return placeOrder();
    setStep('paying');
    await startPayment(checkout);
  };

  const back = () => {
    const i = STEPS.findIndex((s) => s.key === step);
    if (i > 0) setStep(STEPS[i - 1].key);
    else router.back();
  };

  const setAddr = (patch: Partial<AddressDraft>) => setAddress((a) => ({ ...a, ...patch }));

  return (
    <Screen>
      <Stack.Screen options={{ headerBackVisible: step === 'contact', title: step === 'confirmation' ? 'Thank you' : 'Checkout' }} />
      {STEPS.some((s) => s.key === step) ? <Stepper step={step} /> : null}

      {step === 'contact' ? (
        <View>
          <H2 style={styles.stepTitle}>Contact</H2>
          {auth.status !== 'signedIn' ? (
            <View style={styles.signinHint}>
              <Small style={{ flex: 1 }}>Have an account? Sign in for faster checkout and order tracking.</Small>
              <TextLink title="Sign in" onPress={() => router.push('/account/sign-in')} />
            </View>
          ) : null}
          <Field label="Email" value={contact.email} onChangeText={(v) => setContact({ ...contact, email: v })} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={contactErrors.email} />
          <Field label="Phone" value={contact.phone} onChangeText={(v) => setContact({ ...contact, phone: v })} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" error={contactErrors.phone} hint="For delivery updates" />
          <Field label="First name" value={contact.firstName} onChangeText={(v) => setContact({ ...contact, firstName: v })} autoComplete="given-name" textContentType="givenName" error={contactErrors.firstName} />
          <Field label="Last name" value={contact.lastName} onChangeText={(v) => setContact({ ...contact, lastName: v })} autoComplete="family-name" textContentType="familyName" error={contactErrors.lastName} />
          <Button title="Continue to delivery" onPress={goContactNext} />
        </View>
      ) : null}

      {step === 'delivery' ? (
        <View>
          <H2 style={styles.stepTitle}>Delivery</H2>
          <View accessibilityRole="radiogroup">
            {methods.map((m) => (
              <OptionRow
                key={m.id}
                selected={methodId === m.id}
                title={m.label}
                detail={[m.eta, m.fee ? formatNaira(m.fee) : 'Free', m.freeOver ? `free over ${formatNaira(m.freeOver)}` : null, m.regions && !m.regions.includes('*') ? m.regions.join(', ') + ' only' : null]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => setMethodId(m.id)}
              />
            ))}
          </View>

          {methodId === PICKUP_ID ? (
            <View style={{ marginTop: space.md }}>
              <Label style={{ marginBottom: space.sm }}>Collect from</Label>
              {stores.map((s) => (
                <OptionRow key={s.slug} selected={storeSlug === s.slug} title={s.name} detail={s.address ?? 'Address awaiting CNM confirmation'} onPress={() => setStoreSlug(s.slug)} />
              ))}
            </View>
          ) : methodId ? (
            <View style={{ marginTop: space.md }}>
              <Label style={{ marginBottom: space.sm }}>Delivery address</Label>
              {savedAddresses.length ? (
                <View style={{ marginBottom: space.sm }}>
                  {savedAddresses.map((a) => (
                    <OptionRow
                      key={a.id}
                      selected={address.line1 === a.line1 && address.city === a.city}
                      title={a.label || `${a.firstName} ${a.lastName}`}
                      detail={[a.line1, a.city, a.state].filter(Boolean).join(', ')}
                      onPress={() => setAddress({ firstName: a.firstName, lastName: a.lastName, phone: a.phone, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, country: a.country || 'NG' })}
                    />
                  ))}
                </View>
              ) : null}
              <Field label="Address line 1" value={address.line1} onChangeText={(v) => setAddr({ line1: v })} autoComplete="street-address" textContentType="streetAddressLine1" error={addressErrors.line1} />
              <Field label="Address line 2 (optional)" value={address.line2} onChangeText={(v) => setAddr({ line2: v })} textContentType="streetAddressLine2" />
              <Field label="City" value={address.city} onChangeText={(v) => setAddr({ city: v })} textContentType="addressCity" error={addressErrors.city} />
              <Field label="State" value={address.state} onChangeText={(v) => setAddr({ state: v })} textContentType="addressState" error={addressErrors.state} hint="e.g. Lagos, FCT" />
              <Field label="Recipient phone (optional)" value={address.phone} onChangeText={(v) => setAddr({ phone: v })} keyboardType="phone-pad" />
            </View>
          ) : null}

          <View style={styles.nav}>
            <Button title="Back" variant="secondary" onPress={back} style={{ flex: 1 }} />
            <Button title="Continue" onPress={goDeliveryNext} disabled={!methodId} style={{ flex: 2 }} />
          </View>
        </View>
      ) : null}

      {step === 'payment' ? (
        <View>
          <H2 style={styles.stepTitle}>Payment</H2>
          <View style={styles.panel}>
            <Body>You’ll pay securely on Paystack’s hosted page — card, bank transfer or USSD. CNM never sees your card details.</Body>
            {IS_STAGING ? <Small style={{ marginTop: space.sm, color: colors.muted }}>Staging: if no payment key is configured the server returns a simulated payment you can approve or decline.</Small> : null}
          </View>
          <Small style={{ color: colors.muted, marginTop: space.sm }}>Payment provider is awaiting CNM approval.</Small>
          <View style={styles.nav}>
            <Button title="Back" variant="secondary" onPress={back} style={{ flex: 1 }} />
            <Button title="Review order" onPress={() => setStep('review')} style={{ flex: 2 }} />
          </View>
        </View>
      ) : null}

      {step === 'review' ? (
        <View>
          <H2 style={styles.stepTitle}>Review</H2>
          <View style={styles.reviewBlock}>
            <View style={styles.reviewHead}>
              <Label style={{ flex: 1 }}>Contact</Label>
              <TextLink title="Edit" onPress={() => setStep('contact')} />
            </View>
            <Body>{`${contact.firstName} ${contact.lastName}`}</Body>
            <Small>{`${contact.email} · ${contact.phone}`}</Small>
          </View>
          <View style={styles.reviewBlock}>
            <View style={styles.reviewHead}>
              <Label style={{ flex: 1 }}>Delivery</Label>
              <TextLink title="Edit" onPress={() => setStep('delivery')} />
            </View>
            <Body>{method?.label}</Body>
            <Small>
              {methodId === PICKUP_ID
                ? stores.find((s) => s.slug === storeSlug)?.name
                : [address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')}
            </Small>
          </View>
          <View style={styles.reviewBlock}>
            <Label style={{ marginBottom: space.sm }}>Items</Label>
            {bag.lines.map((l) => {
              const p = findProduct(catalogue, l.id);
              return (
                <View key={l.id} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                  <Body style={{ flex: 1 }}>
                    {p?.name ?? l.id} × {l.qty}
                  </Body>
                  <Body>{p ? formatNaira(p.price.amount * l.qty) : ''}</Body>
                </View>
              );
            })}
          </View>
          <Field label="Order notes (optional)" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }} />
          <Totals quote={quote} loading={quoting} lines={bag.lines} delivery={method} deliveryChosen />
          {quoteError ? <ErrorNote message={`Couldn’t confirm totals: ${quoteError}`} onRetry={refetch} /> : null}
          {placeError ? <ErrorNote message={placeError} onRetry={placeOrder} /> : null}
          <View style={styles.nav}>
            <Button title="Back" variant="secondary" onPress={back} style={{ flex: 1 }} disabled={placing} />
            <Button
              title={quote ? `Pay ${formatNaira(quote.total)}` : 'Place order'}
              onPress={placeOrder}
              loading={placing}
              disabled={!quote || quoting}
              style={{ flex: 2 }}
              accessibilityHint="Places your order and opens secure payment"
            />
          </View>
          <ButterflyLoader pending={placing} label="Placing your order" style={{ marginTop: space.md }} />
        </View>
      ) : null}

      {step === 'paying' && checkout ? (
        <View style={{ paddingTop: space.lg }}>
          <H1>Order {checkout.order.number}</H1>
          <Body style={{ marginTop: space.xs }}>Total {formatNaira(checkout.order.total)}</Body>
          {checkout.payment.mode === 'simulated' ? (
            <View style={[styles.panel, { marginTop: space.lg, borderColor: colors.danger }]}>
              <Label style={{ color: colors.danger, marginBottom: space.xs }}>Staging payment</Label>
              <Small style={{ marginBottom: space.md }}>No payment provider is configured on this environment. Choose an outcome to test the flow. No money moves.</Small>
              <Button title="Simulate success" onPress={() => simulate('success')} disabled={paying} />
              <Button title="Simulate failure" variant="danger" onPress={() => simulate('failure')} disabled={paying} style={{ marginTop: space.sm }} />
            </View>
          ) : (
            <View style={{ marginTop: space.lg }}>
              <Small>Complete payment in the secure Paystack window. We’ll confirm with CNM as soon as you return.</Small>
              {!paying ? <Button title="Open payment page" onPress={() => startPayment(checkout)} style={{ marginTop: space.md }} /> : null}
            </View>
          )}
          <PendingBlock pending={paying} message="Confirming your payment…" />
        </View>
      ) : null}

      {step === 'failed' ? (
        <View style={{ paddingTop: space.lg }}>
          <H1>Payment not completed</H1>
          <Body style={{ marginTop: space.sm, color: colors.inkSoft }}>
            {payResult?.message ?? 'Your payment didn’t go through and you have not been charged by CNM. Your bag has been kept.'}
          </Body>
          {checkout ? <Small style={{ marginTop: space.xs }}>Order reference {checkout.order.number}</Small> : null}
          <Button title="Try payment again" onPress={retryPayment} loading={paying || placing} style={{ marginTop: space.lg }} />
          <Button title="Back to bag" variant="secondary" onPress={() => router.replace('/bag')} style={{ marginTop: space.sm }} />
        </View>
      ) : null}

      {step === 'confirmation' && checkout ? (
        <View style={{ paddingTop: space.xl }}>
          <Label style={{ color: colors.charcoal }}>Order confirmed</Label>
          <H1 style={{ marginTop: space.sm }}>Thank you, {contact.firstName}.</H1>
          <Body style={{ marginTop: space.sm, color: colors.inkSoft }}>
            Your order {checkout.order.number} is confirmed. We’ve sent a receipt to {contact.email}.
          </Body>
          <Divider style={{ marginVertical: space.lg }} />
          {confirmedLines.map((l) => {
            const p = findProduct(catalogue, l.id);
            return (
              <Body key={l.id}>
                {p?.name ?? l.id} × {l.qty}
              </Body>
            );
          })}
          <Body style={{ marginTop: space.sm, fontWeight: '600' }}>Total {formatNaira(checkout.order.total)}</Body>
          {auth.status === 'signedIn' ? (
            <Button title="View order" onPress={() => router.replace(`/account/orders/${checkout.order.number}`)} style={{ marginTop: space.xl }} />
          ) : null}
          <Button title="Continue shopping" variant={auth.status === 'signedIn' ? 'secondary' : 'primary'} onPress={() => router.replace('/')} style={{ marginTop: space.sm }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', gap: 4, marginBottom: space.lg },
  stepItem: { flex: 1, borderTopWidth: 2, borderColor: colors.hairline, paddingTop: space.xs },
  stepTitle: { marginBottom: space.md },
  signinHint: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md, backgroundColor: colors.offWhite, paddingHorizontal: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouch + 16,
    borderWidth: hairline,
    borderColor: colors.hairline,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.ink, marginRight: space.md },
  radioOn: { borderWidth: 6, borderColor: colors.charcoal },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  panel: { borderWidth: hairline, borderColor: colors.hairline, borderRadius: radius, padding: space.md },
  reviewBlock: { borderBottomWidth: hairline, borderColor: colors.hairline, paddingBottom: space.md, marginBottom: space.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center' },
});
