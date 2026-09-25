import { router } from 'expo-router';
import { memo, useEffect, useRef, type ReactElement } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { track } from '@/lib/analytics';
import { categoryName } from '@/lib/catalogue';
import type { Product } from '@/lib/types';
import { useCatalogue } from '@/state/catalogue';
import { useWishlist } from '@/state/wishlist';
import { colors, space, type } from '@/theme';

import { PriceTag, ProductFlags, ProductImage, ProductSubtitle, StockLabel } from './product-bits';
import { HeartButton } from './ui';

export const ProductCard = memo(function ProductCard({ product, list, width }: { product: Product; list?: string; width?: number }) {
  const { catalogue } = useCatalogue();
  const wishlist = useWishlist();
  const saved = wishlist.has(product.id);
  return (
    <View style={[styles.card, width ? { width } : { flex: 1 }]}>
      <Pressable
        onPress={() => {
          if (list) track('select_item', { item_list_name: list, items: [{ item_id: product.id, item_name: product.name }] });
          router.push(`/products/${product.slug}`);
        }}
        accessibilityRole="link"
        accessibilityLabel={`${product.name}, ${[product.brand, product.productType ?? categoryName(catalogue, product.category)].filter(Boolean).join(', ')}`}
        accessibilityHint="Opens product details"
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <ProductImage product={product} compact={!!width && width < 160} style={styles.image} />
        <View style={styles.meta}>
          <ProductFlags product={product} />
          <ProductSubtitle product={product} style={{ marginBottom: 2 }} />
          <Text style={[type.body, styles.name]} numberOfLines={2}>
            {product.name}
          </Text>
          <PriceTag product={product} />
          <View style={{ marginTop: 2 }}>
            <StockLabel product={product} />
          </View>
        </View>
      </Pressable>
      <HeartButton active={saved} onPress={() => wishlist.toggle(product)} label={product.name} style={styles.heart} />
    </View>
  );
});

export function ProductGrid({
  products,
  list,
  header,
  footer,
  empty,
  onRefresh,
  refreshing,
}: {
  products: Product[];
  list: string;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  empty?: ReactElement | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const renderItem: ListRenderItem<Product> = ({ item }) => <ProductCard product={item} list={list} />;
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.gridContent}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      onRefresh={onRefresh}
      refreshing={!!refreshing}
      keyboardDismissMode="on-drag"
      accessibilityLabel={`${products.length} products`}
    />
  );
}

export function ProductRail({ products, list, cardWidth = 168 }: { products: Product[]; list: string; cardWidth?: number }) {
  if (!products.length) return null;
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProductCard product={item} list={list} width={cardWidth} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space.md, gap: space.sm }}
    />
  );
}

function SkeletonBlock({ style }: { style: object }) {
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, pulse]);
  return <Animated.View style={[{ backgroundColor: colors.offWhite, opacity: pulse }, style]} />;
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.skeletonWrap} accessible accessibilityLabel="Loading products" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBlock style={{ aspectRatio: 4 / 5 }} />
          <SkeletonBlock style={{ height: 12, marginTop: space.sm, width: '80%' }} />
          <SkeletonBlock style={{ height: 10, marginTop: space.xs, width: '45%' }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.lg },
  image: { borderWidth: 1, borderColor: colors.hairline },
  meta: { paddingTop: space.sm, paddingRight: space.xs },
  name: { fontSize: 15, marginBottom: space.xs },
  heart: { position: 'absolute', top: 2, right: 2 },
  column: { gap: space.sm, paddingHorizontal: space.md },
  gridContent: { paddingBottom: space.xxl },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md, justifyContent: 'space-between' },
  skeletonCard: { width: '48.5%', marginBottom: space.lg },
});
