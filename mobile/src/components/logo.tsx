import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * ORIGINAL CNM Essentials artwork, copied from the website
 * (public/assets/brand/, cropped by the website team from the logo on
 * cnm-group.net). Never redraw or recolour it.
 * When CNM supplies master files, replace the PNGs in assets/brand/ at the same
 * paths (keep the aspect ratios below in sync).
 *
 * - `full`: petal mark + "CNM ESSENTIALS" + strapline on charcoal (702×801)
 * - `mark`: petal mark only, on charcoal (300×300)
 */
const SOURCES = {
  full: { source: require('../../assets/brand/cnm-logo.png'), aspect: 702 / 801 },
  mark: { source: require('../../assets/brand/cnm-mark.png'), aspect: 1 },
} as const;

interface Props {
  variant?: keyof typeof SOURCES;
  /** Rendered height in points; width follows the artwork's aspect ratio. */
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function Logo({ variant = 'mark', height = 32, style }: Props) {
  const { source, aspect } = SOURCES[variant];
  return (
    <Image
      source={source}
      style={[{ height, width: height * aspect, borderRadius: 2 }, style]}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="CNM Essentials"
    />
  );
}
