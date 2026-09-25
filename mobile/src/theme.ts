/** CNM Essentials design tokens. Editorial calm, hairlines, square corners. */
/** Palette sampled from the original CNM Essentials logo. */
export const colors = {
  charcoal: '#23221e',
  charcoalPressed: '#11110f',
  charcoalSoft: '#3a3833',
  sage: '#d3dbce',
  yellow: '#fbcc39',
  yellowPressed: '#e9b91f',
  offWhite: '#f6f5f0',
  ink: '#111111',
  inkSoft: '#4a4a46',
  muted: '#77766f',
  hairline: '#e3e5de',
  white: '#ffffff',
  danger: '#8a2a1f',
  overlay: 'rgba(17,17,17,0.4)',
} as const;

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemiBold: 'HankenGrotesk_600SemiBold',
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
} as const;

export const radius = 2;
export const hairline = 1;
/** Minimum touch target (Apple HIG 44pt / Material 48dp — we use 44 as the floor). */
export const minTouch = 44;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 48, color: colors.ink },
  h1: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: colors.ink },
  h2: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.ink },
  h3: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: colors.ink,
  },
  price: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 18, color: colors.ink },
} as const;
