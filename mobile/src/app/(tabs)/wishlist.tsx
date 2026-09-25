import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { PriceTag, ProductImage, StockLabel } from '@/components/product-bits';
import { Button, EmptyState, IconButton, Small, TextLink } from '@/components/ui';
import { track } from '@/lib/analytics';
import { findProduct, isPurchasable } from '@/lib/catalogue';
import { WEB_BASE_URL } from '@/lib/config';
import type { Product } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { useBag } from '@/state/bag';
import { useCatalogue } from '@/state/catalogue';
import { useToast } from '@/state/toast';
import { useWishlist } from '@/state/wishlist';
import { colors, hairline, space, type } from '@/theme';

export default function WishlistScreen() {
  const { catalogue } = useCatalogue();
  const wishlist = useWishlist();
  const bag = useBag();
  const toast = useToast();
  const { status } = useAuth();

  const products = useMemo(() => wishlist.ids.map((id) => findProduct(catalogue, id)).filter((p): p is Product => !!p), [wishlist.ids, catalogue]);

  const moveToBag = (p: Product) => {
    const res = bag.add(p, 1);
    if (res.ok) {
      wishlist.remove(p.id);
      toast(`${p.name} moved to bag`, { actionLabel: 'View bag', onAction: () => router.push('/bag') });
    } else {
      toast(res.reason === 'out_of_stock' ? 'This item is out of stock.' : 'You already have the maximum in your bag.');
    }
  };

  const shareOne = async (p: Product) => {
    const url = `${WEB_BASE_URL}/products/${p.slug}/`;
    try {
      await Share.share({ message: `${p.name} — CNM Essentials\n${url}`, url });
      track('share', { content_type: 'product', item_id: p.id, source: 'wishlist' });
    } catch {}
  };

  const shareAll = async () => {
    const lines = products.map((p) => `${p.name}: ${WEB_BASE_URL}/products/${p.slug}/`);
    try {
      await Share.share({ message: `My CNM Essentials wishlist\n\n${lines.join('\n')}` });
      track('share', { content_type: 'wishlist', items: products.length });
    } catch {}
  };

  if (!products.length) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Your wishlist is empty"
          body={status === 'signedIn' ? 'Tap the heart on any product to save it here.' : 'Tap the heart on any product to save it. Sign in to keep your wishlist across devices.'}
          action="Explore the shop"
          onAction={() => router.push('/shop')}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.page}
      data={products}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Small style={{ flex: 1 }}>
            {products.length} saved {products.length === 1 ? 'item' : 'items'}
            {status !== 'signedIn' ? ' · on this device' : ''}
          </Small>
          <TextLink title="Share list" onPress={shareAll} />
        </View>
      }
      ListFooterComponent={
        status !== 'signedIn' ? (
          <View style={{ padding: space.md }}>
            <Button title="Sign in to sync your wishlist" variant="secondary" onPress={() => router.push('/account/sign-in')} />
          </View>
        ) : null
      }
      renderItem={({ item: p }) => (
        <View style={styles.row}>
          <Pressable onPress={() => router.push(`/products/${p.slug}`)} accessibilityRole="link" accessibilityLabel={p.name} style={styles.thumb}>
            <ProductImage product={p} compact />
          </Pressable>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={type.body} numberOfLines={2}>
              {p.name}
            </Text>
            <View style={{ marginTop: space.xxs }}>
              <PriceTag product={p} />
            </View>
            <StockLabel product={p} />
            <View style={styles.actions}>
              <Button title={isPurchasable(p) ? 'Move to bag' : 'Out of stock'} compact disabled={!isPurchasable(p)} onPress={() => moveToBag(p)} style={{ flex: 1 }} />
              <IconButton icon="share" label={`Share ${p.name}`} size={18} onPress={() => shareOne(p)} />
              <IconButton
                icon="trash-2"
                label={`Remove ${p.name} from wishlist`}
                size={18}
                onPress={() => {
                  wishlist.remove(p.id);
                  toast(`${p.name} removed`, { actionLabel: 'Undo', onAction: () => wishlist.add(p) });
                }}
              />
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.xs },
  row: { flexDirection: 'row', padding: space.md, borderTopWidth: hairline, borderColor: colors.hairline },
  thumb: { width: 104 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
});
