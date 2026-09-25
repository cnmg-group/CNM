import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { absoluteUrl, productImages, productSubtitle, stockState } from '@/lib/catalogue';
import { API_BASE_URL } from '@/lib/config';
import { formatNaira } from '@/lib/format';
import type { Product } from '@/lib/types';
import { colors, fonts, hairline, radius, space, type } from '@/theme';

import { Label, Small } from './ui';

/** Shown only when a product has no image — never a stock or AI image. */
export function ImagePlaceholder({ style, compact }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
  return (
    <View
      style={[styles.placeholder, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Product photography awaiting CNM approval"
    >
      <Text style={styles.placeholderMark} maxFontSizeMultiplier={1.2}>
        CNM
      </Text>
      {!compact ? (
        <Text style={styles.placeholderNote} maxFontSizeMultiplier={1.3}>
          Photography awaiting CNM approval
        </Text>
      ) : null}
    </View>
  );
}

export function ProductImage({ product, index = 0, style, compact }: { product: Product; index?: number; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const img = productImages(product)[index];
  if (!img) return <ImagePlaceholder style={style} compact={compact} />;
  return (
    <View style={[styles.imageWrap, style]}>
      {/* Packshots are served by the website; `contain` keeps the whole bottle in frame. */}
      <Image
        source={{ uri: absoluteUrl(API_BASE_URL, img.src) }}
        style={styles.image}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={img.alt || product.name}
      />
    </View>
  );
}

export function DemoTag() {
  return (
    <View style={styles.demo} accessible accessibilityLabel="Demo price, awaiting CNM approval">
      <Text style={styles.demoText} maxFontSizeMultiplier={1.3}>
        Demo price
      </Text>
    </View>
  );
}

export function PriceTag({ product, large }: { product: Product; large?: boolean }) {
  const { amount, compareAt, demo } = product.price;
  const onSale = compareAt != null && compareAt > amount;
  return (
    <View style={styles.priceRow}>
      <Text style={[type.price, large && { fontSize: 18, lineHeight: 24 }]} accessibilityLabel={`Price ${formatNaira(amount)}`}>
        {formatNaira(amount)}
      </Text>
      {onSale ? (
        <Text style={[type.small, styles.strike]} accessibilityLabel={`Was ${formatNaira(compareAt)}`}>
          {formatNaira(compareAt)}
        </Text>
      ) : null}
      {demo ? <DemoTag /> : null}
    </View>
  );
}

export function StockLabel({ product }: { product: Product }) {
  const state = stockState(product);
  if (state === 'in_stock') return <Small style={{ color: colors.charcoal }}>In stock</Small>;
  if (state === 'low_stock') return <Small style={{ color: colors.ink }}>Low stock</Small>;
  if (state === 'unconfirmed') return <Small style={{ color: colors.muted }}>Availability to be confirmed</Small>;
  return <Small style={{ color: colors.muted }}>Out of stock</Small>;
}

/** Brand + product type, e.g. "VICTORIA'S SECRET · ROOM SPRAY". */
export function ProductSubtitle({ product, style }: { product: Product; style?: StyleProp<TextStyle> }) {
  const text = productSubtitle(product);
  if (!text) return null;
  return (
    <Label style={[{ color: colors.muted, fontSize: 10 }, style]} numberOfLines={2}>
      {text}
    </Label>
  );
}

export function ProductFlags({ product }: { product: Product }) {
  const flags = [product.isNew && 'New', product.isBestSeller && 'Best seller'].filter(Boolean) as string[];
  if (!flags.length) return null;
  return <Label style={{ color: colors.charcoal, marginBottom: 4 }}>{flags.join(' · ')}</Label>;
}

/** Shown in place of any product fact CNM has not yet supplied. Never filled with invented copy. */
export function AwaitingApproval({ what }: { what?: string }) {
  return (
    <Small style={styles.awaiting} accessibilityLabel={`${what ? what + ': ' : ''}details awaiting CNM approval`}>
      Details awaiting CNM approval
    </Small>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 4 / 5,
    padding: space.md,
  },
  placeholderMark: { fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 4, color: colors.charcoal },
  placeholderNote: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: space.xs,
    textAlign: 'center',
  },
  imageWrap: { aspectRatio: 4 / 5, backgroundColor: colors.white, overflow: 'hidden' },
  image: { position: 'absolute', top: '6%', bottom: '6%', left: '6%', right: '6%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  strike: { textDecorationLine: 'line-through', color: colors.muted },
  demo: { borderWidth: hairline, borderColor: colors.hairline, borderRadius: radius, paddingHorizontal: 5, paddingVertical: 1 },
  demoText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted },
  awaiting: { color: colors.muted, fontStyle: 'italic' },
});
