import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme';

/**
 * ORIGINAL CNM LOGO — BLOCKED, awaiting CNM.
 *
 * The official logo file has not been supplied. It must never be redrawn or
 * approximated. When CNM provides it:
 *   1. Save it as  assets/brand/cnm-logo.png  (transparent PNG, @3x-ready, ~600px wide)
 *   2. Replace `null` below with:  require('../../assets/brand/cnm-logo.png')
 *   3. Set LOGO_ASPECT to the file's width / height.
 * Until then a plain typographic wordmark is shown (not a logo).
 */
const LOGO_SOURCE: ImageSourcePropType | null = null;
const LOGO_ASPECT = 4;

interface Props {
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Logo({ height = 18, color = colors.ink, style }: Props) {
  if (LOGO_SOURCE) {
    return (
      <Image
        source={LOGO_SOURCE}
        style={[{ height, width: height * LOGO_ASPECT, resizeMode: 'contain' }, style as never]}
        accessibilityRole="image"
        accessibilityLabel="CNM Essentials"
      />
    );
  }
  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="header" accessibilityLabel="CNM Essentials">
      <Text style={[styles.word, { color, fontSize: height * 0.8, lineHeight: height }]} maxFontSizeMultiplier={1.2}>
        CNM ESSENTIALS
      </Text>
      {__DEV__ ? (
        <Text style={styles.flag} importantForAccessibility="no" accessibilityElementsHidden>
          logo placeholder
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: { fontFamily: fonts.sansMedium, letterSpacing: 4 },
  flag: {
    fontFamily: fonts.sans,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.danger,
    marginTop: 1,
  },
});
