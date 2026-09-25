import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Accordion } from '@/components/accordion';
import { PendingBlock } from '@/components/butterfly-loader';
import { AwaitingApproval, PriceTag, ProductFlags, ProductImage, StockLabel } from '@/components/product-bits';
import { ProductRail } from '@/components/product-card';
import { QtyStepper } from '@/components/qty-stepper';
import { Screen } from '@/components/screen';
import { Body, Button, EmptyState, Field, H1, HeartButton, IconButton, Label, SectionHeader, Small } from '@/components/ui';
import { itemParams, track } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { categoryName, findProduct, isPurchasable, productImages, relatedProducts, stockState } from '@/lib/catalogue';
import { WEB_BASE_URL } from '@/lib/config';
import { formatNaira } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { useBag } from '@/state/bag';
import { stores, useCatalogue } from '@/state/catalogue';
import { useRecentlyViewed } from '@/state/recently-viewed';
import { useToast } from '@/state/toast';
import { useWishlist } from '@/state/wishlist';
import { colors, hairline, space } from '@/theme';

function TextOrList({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) return <Body>{value.join(', ')}</Body>;
  return <Body>{value}</Body>;
}

function ScentNotes({ notes }: { notes: Product['scentNotes'] }) {
  if (!notes) return <AwaitingApproval what="Scent notes" />;
  if (typeof notes === 'string' || Array.isArray(notes)) return <TextOrList value={notes} />;
  const tiers = (['top', 'heart', 'base'] as const).filter((k) => notes[k]?.length);
  if (!tiers.length) return <AwaitingApproval what="Scent notes" />;
  return (
    <View style={{ gap: space.sm }}>
      {tiers.map((k) => (
        <View key={k}>
          <Label style={{ color: colors.muted }}>{k} notes</Label>
          <Body>{notes[k]!.join(', ')}</Body>
        </View>
      ))}
    </View>
  );
}

function Gallery({ product }: { product: Product }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const images = productImages(product);
  const pages = images.length ? images.map((_, i) => i) : [0];
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={pages}
        keyExtractor={(i) => String(i)}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <ProductImage product={product} index={item} style={{ width }} />}
        accessibilityLabel={images.length ? `Image ${index + 1} of ${images.length}` : undefined}
      />
      {pages.length > 1 ? (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {pages.map((i) => (
            <View key={i} style={[styles.dot, i === index && { backgroundColor: colors.ink }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BackInStock({ product }: { product: Product }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (state === 'done') return <Small style={{ color: colors.green, marginTop: space.sm }}>We’ll email you when it’s back.</Small>;
  return (
    <View style={{ marginTop: space.md }}>
      <Field label="Email me when it’s back" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error} />
      <Button
        title="Notify me"
        variant="secondary"
        loading={state === 'sending'}
        onPress={async () => {
          if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email address.');
          setError(null);
          setState('sending');
          try {
            await api('/api/back-in-stock', { method: 'POST', body: { email: email.trim(), productId: product.id } });
            setState('done');
          } catch (e) {
            setError(errorMessage(e));
            setState('idle');
          }
        }}
      />
    </View>
  );
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { catalogue, commerce, loading } = useCatalogue();
  const bag = useBag();
  const wishlist = useWishlist();
  const toast = useToast();
  const recently = useRecentlyViewed();
  const product = findProduct(catalogue, slug);
  const [qty, setQty] = useState(1);

  const max = product ? bag.maxFor(product.id) : 0;
  const inBag = product ? bag.lines.find((l) => l.id === product.id)?.qty ?? 0 : 0;
  const remaining = Math.max(0, max - inBag);

  useEffect(() => {
    if (!product) return;
    recently.markViewed(product.id);
    track('view_item', itemParams(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    if (qty > Math.max(1, remaining)) setQty(Math.max(1, remaining));
  }, [remaining, qty]);

  const related = useMemo(() => (product ? relatedProducts(catalogue, product) : []), [catalogue, product]);
  const recent = useMemo(
    () => recently.ids.filter((id) => id !== product?.id).map((id) => findProduct(catalogue, id)).filter((p): p is Product => !!p),
    [recently.ids, catalogue, product?.id],
  );

  if (!product) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        {loading ? <PendingBlock pending label="Loading product" /> : <EmptyState title="Product not found" body="It may have been renamed or removed." action="Browse the shop" onAction={() => router.replace('/shop')} />}
      </Screen>
    );
  }

  const saved = wishlist.has(product.id);
  const state = stockState(product);

  const share = async () => {
    const url = `${WEB_BASE_URL}/products/${product.slug}/`;
    try {
      await Share.share({ message: `${product.name} — CNM Essentials\n${url}`, url, title: product.name });
      track('share', { content_type: 'product', item_id: product.id });
    } catch {
      // user cancelled
    }
  };

  const addToBag = () => {
    const res = bag.add(product, qty);
    if (res.ok) {
      toast(res.capped ? `Added — limited to ${max} per order` : `Added to bag`, { actionLabel: 'View bag', onAction: () => router.push('/bag') });
      setQty(1);
    } else {
      toast(res.reason === 'out_of_stock' ? 'This item is out of stock.' : `You already have the maximum (${max}) in your bag.`);
    }
  };

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton icon="share" label={`Share ${product.name}`} onPress={share} />
            </View>
          ),
        }}
      />
      <Gallery product={product} />

      <View style={styles.pad}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <ProductFlags product={product} />
            <Label style={{ color: colors.muted, marginBottom: space.xs }}>{categoryName(catalogue, product.category)}</Label>
            <H1>{product.name}</H1>
          </View>
          <HeartButton active={saved} onPress={() => wishlist.toggle(product)} label={product.name} />
        </View>

        <View style={{ marginTop: space.sm }}>
          <PriceTag product={product} large />
          <View style={{ marginTop: space.xs }}>
            <StockLabel product={product} />
          </View>
        </View>

        {isPurchasable(product) ? (
          <View style={styles.buyRow}>
            <QtyStepper value={qty} max={Math.max(1, remaining)} onChange={setQty} />
            <Button
              title={remaining <= 0 ? 'Maximum in bag' : 'Add to bag'}
              onPress={addToBag}
              disabled={remaining <= 0}
              style={{ flex: 1, marginLeft: space.sm }}
              accessibilityHint={`Adds ${qty} to your bag`}
            />
          </View>
        ) : (
          <BackInStock product={product} />
        )}
        {inBag > 0 ? <Small style={{ marginTop: space.xs }}>{inBag} already in your bag.</Small> : null}
        {state === 'low_stock' ? <Small style={{ marginTop: space.xs }}>Only a few left.</Small> : null}

        <View style={styles.sections}>
          <Accordion title="Description" initiallyOpen>
            {product.description ? <Body>{product.description}</Body> : <AwaitingApproval what="Description" />}
          </Accordion>
          <Accordion title="Scent notes">
            <ScentNotes notes={product.scentNotes} />
          </Accordion>
          {product.ingredients ? (
            <Accordion title="Ingredients">
              <TextOrList value={product.ingredients} />
            </Accordion>
          ) : null}
          <Accordion title="How to use">{product.howToUse ? <Body>{product.howToUse}</Body> : <AwaitingApproval what="How to use" />}</Accordion>
          <Accordion title="Size">{product.size ? <Body>{product.size}</Body> : <AwaitingApproval what="Size" />}</Accordion>
          <Accordion title="Care">{product.care ? <Body>{product.care}</Body> : <AwaitingApproval what="Care" />}</Accordion>
          <Accordion title="Delivery">
            <View style={{ gap: space.sm }}>
              {commerce.deliveryMethods.map((m) => (
                <View key={m.id}>
                  <Body>{m.label}</Body>
                  <Small>
                    {[m.eta, m.fee ? formatNaira(m.fee) : 'Free', m.freeOver ? `free over ${formatNaira(m.freeOver)}` : null].filter(Boolean).join(' · ')}
                  </Small>
                </View>
              ))}
              <Small style={{ color: colors.muted }}>Delivery fees are staging values awaiting CNM approval. Final fees are confirmed at checkout.</Small>
            </View>
          </Accordion>
          <Accordion title="Returns">{commerce.returns.value ? <Body>{commerce.returns.value}</Body> : <AwaitingApproval what="Returns policy" />}</Accordion>
          <Accordion title="Store availability">
            <View style={{ gap: space.sm }}>
              {stores.map((s) => (
                <View key={s.slug}>
                  <Body>{s.name}</Body>
                  <Small>{s.address ?? 'Address awaiting CNM confirmation'}</Small>
                </View>
              ))}
              <Small style={{ color: colors.muted }}>Live in-store stock isn’t available yet — please contact the store before visiting.</Small>
            </View>
          </Accordion>
          <Accordion title="FAQs">
            {product.faqs.filter((f) => f.a).length ? (
              <View style={{ gap: space.md }}>
                {product.faqs
                  .filter((f) => f.a)
                  .map((f) => (
                    <View key={f.q}>
                      <Body style={{ fontWeight: '600' }}>{f.q}</Body>
                      <Body>{f.a}</Body>
                    </View>
                  ))}
              </View>
            ) : (
              <AwaitingApproval what="FAQs" />
            )}
          </Accordion>
          <View style={styles.hairline} />
        </View>
      </View>

      {related.length ? (
        <View style={styles.rail}>
          <View style={styles.pad}>
            <SectionHeader title="You may also like" />
          </View>
          <ProductRail products={related} list="pdp_related" />
        </View>
      ) : null}
      {recent.length ? (
        <View style={styles.rail}>
          <View style={styles.pad}>
            <SectionHeader title="Recently viewed" />
          </View>
          <ProductRail products={recent} list="pdp_recently_viewed" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.lg },
  buyRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
  sections: { marginTop: space.xl },
  hairline: { height: hairline, backgroundColor: colors.hairline },
  rail: { marginTop: space.xxl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairline },
});
