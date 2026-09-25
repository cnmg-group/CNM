import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AwaitingApproval, PriceTag, ProductImage } from '@/components/product-bits';
import { QtyStepper } from '@/components/qty-stepper';
import { Screen } from '@/components/screen';
import { Totals } from '@/components/totals';
import { Button, EmptyState, ErrorNote, Field, Label, Small, TextLink } from '@/components/ui';
import { useQuote } from '@/hooks/use-quote';
import { track } from '@/lib/analytics';
import { unavailableLines } from '@/lib/cart';
import { findProduct } from '@/lib/catalogue';
import { useBag } from '@/state/bag';
import { useCatalogue } from '@/state/catalogue';
import { useToast } from '@/state/toast';
import { useWishlist } from '@/state/wishlist';
import { colors, hairline, space, type } from '@/theme';

export default function BagScreen() {
  const { catalogue, commerce } = useCatalogue();
  const bag = useBag();
  const wishlist = useWishlist();
  const toast = useToast();
  const { quote, loading, error, refetch } = useQuote(bag.lines, bag.promoCode);
  const [promoInput, setPromoInput] = useState(bag.promoCode ?? '');
  const unavailable = useMemo(() => unavailableLines(bag.lines, catalogue), [bag.lines, catalogue]);

  useEffect(() => {
    if (bag.lines.length) track('view_cart', { currency: 'NGN', items: bag.lines.map((l) => ({ item_id: l.id, quantity: l.qty })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (quote?.promo?.code && bag.promoCode) track('apply_promo', { coupon: quote.promo.code, valid: quote.promo.valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.promo?.code, quote?.promo?.valid]);

  if (!bag.lines.length) {
    return (
      <Screen>
        <EmptyState title="Your bag is empty" body="Discover home fragrance, body care and smart scenting." action="Shop now" onAction={() => router.replace('/shop')} />
      </Screen>
    );
  }

  const promo = quote?.promo;

  return (
    <Screen>
      {bag.lines.map((line) => {
        const p = findProduct(catalogue, line.id);
        if (!p) {
          return (
            <View key={line.id} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>This item is no longer available</Text>
                <TextLink title="Remove" onPress={() => bag.remove(line.id)} />
              </View>
            </View>
          );
        }
        const max = bag.maxFor(p.id);
        const isOut = max <= 0;
        return (
          <View key={line.id} style={styles.line}>
            <Pressable onPress={() => router.push(`/products/${p.slug}`)} style={styles.thumb} accessibilityRole="link" accessibilityLabel={p.name}>
              <ProductImage product={p} compact />
            </Pressable>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.body}>{p.name}</Text>
              {p.size ? <Small>{p.size}</Small> : null}
              <View style={{ marginVertical: space.xxs }}>
                <PriceTag product={p} />
              </View>
              {isOut ? (
                <Small style={{ color: colors.danger }}>Out of stock — please remove to continue.</Small>
              ) : (
                <QtyStepper value={Math.min(line.qty, max)} max={max} onChange={(q) => bag.setQty(p.id, q)} label={`Quantity for ${p.name}`} />
              )}
              {!isOut && line.qty >= max ? <Small style={{ marginTop: space.xxs }}>Maximum {max} per order.</Small> : null}
              <View style={styles.lineActions}>
                <TextLink
                  title="Move to wishlist"
                  onPress={() => {
                    wishlist.add(p);
                    bag.remove(p.id);
                    toast(`${p.name} moved to wishlist`);
                  }}
                />
                <TextLink
                  title="Remove"
                  onPress={() => {
                    bag.remove(p.id);
                    toast(`${p.name} removed`, { actionLabel: 'Undo', onAction: () => bag.add(p, line.qty) });
                  }}
                />
              </View>
            </View>
          </View>
        );
      })}

      <View style={styles.block}>
        <Label style={{ marginBottom: space.sm }}>Promo code</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Code"
              value={promoInput}
              onChangeText={setPromoInput}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => bag.setPromo(promoInput || null)}
              error={promo && promo.code && !promo.valid ? promo.message ?? 'This code isn’t valid.' : null}
              hint={promo?.valid ? promo.message ?? `${promo.code} applied` : undefined}
            />
          </View>
          {bag.promoCode ? (
            <Button
              title="Remove"
              variant="secondary"
              compact
              style={{ marginTop: 22, minHeight: 50 }}
              onPress={() => {
                setPromoInput('');
                bag.setPromo(null);
              }}
            />
          ) : (
            <Button title="Apply" variant="secondary" compact style={{ marginTop: 22, minHeight: 50 }} disabled={!promoInput.trim()} onPress={() => bag.setPromo(promoInput)} />
          )}
        </View>
      </View>

      <View style={styles.block}>
        <Totals quote={quote} loading={loading} lines={bag.lines} deliveryChosen={false} />
        {error ? <ErrorNote message={`Couldn’t confirm totals: ${error}`} onRetry={refetch} /> : null}
      </View>

      {unavailable.length ? <Small style={{ color: colors.danger, marginBottom: space.sm }}>Remove unavailable items to continue.</Small> : null}
      <Button
        title="Checkout"
        disabled={unavailable.length > 0}
        onPress={() => {
          track('begin_checkout', { currency: 'NGN', value: quote?.total, coupon: bag.promoCode ?? undefined, items: bag.lines.map((l) => ({ item_id: l.id, quantity: l.qty })) });
          router.push('/checkout');
        }}
      />
      <View style={{ marginTop: space.md }}>
        <Label style={{ color: colors.muted, marginBottom: space.xxs }}>Returns</Label>
        {commerce.returns.value ? <Small>{commerce.returns.value}</Small> : <AwaitingApproval what="Returns policy" />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', paddingVertical: space.md, borderBottomWidth: hairline, borderColor: colors.hairline },
  thumb: { width: 96 },
  lineActions: { flexDirection: 'row', gap: space.lg },
  block: { paddingVertical: space.lg, borderBottomWidth: hairline, borderColor: colors.hairline, marginBottom: space.lg },
});
