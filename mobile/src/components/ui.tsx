import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, hairline, minTouch, radius, space, type } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

/* ---------- Typography ---------- */

type TProps = TextProps & { style?: StyleProp<TextStyle>; children?: ReactNode };

export function Display({ style, ...p }: TProps) {
  return <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[type.display, style]} {...p} />;
}
export function H1({ style, ...p }: TProps) {
  return <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={[type.h1, style]} {...p} />;
}
export function H2({ style, ...p }: TProps) {
  return <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={[type.h2, style]} {...p} />;
}
export function H3({ style, ...p }: TProps) {
  return <Text maxFontSizeMultiplier={1.8} style={[type.h3, style]} {...p} />;
}
export function Body({ style, ...p }: TProps) {
  return <Text style={[type.body, style]} {...p} />;
}
export function Small({ style, ...p }: TProps) {
  return <Text style={[type.small, style]} {...p} />;
}
export function Label({ style, ...p }: TProps) {
  return <Text maxFontSizeMultiplier={1.8} style={[type.label, style]} {...p} />;
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function Button({ title, variant = 'primary', loading, disabled, icon, style, compact, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && { backgroundColor: pressed ? colors.greenPressed : colors.green, borderColor: colors.green },
        variant === 'secondary' && { backgroundColor: pressed ? colors.cream : colors.white, borderColor: colors.ink },
        variant === 'ghost' && { backgroundColor: pressed ? colors.cream : 'transparent', borderColor: 'transparent' },
        variant === 'danger' && { backgroundColor: pressed ? colors.cream : colors.white, borderColor: colors.danger },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} accessibilityLabel="Loading" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Feather name={icon} size={16} color={fg} style={{ marginRight: space.xs }} /> : null}
          <Text maxFontSizeMultiplier={1.6} style={[styles.buttonText, { color: fg }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: IconName;
  label: string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  badge?: number;
}

export function IconButton({ icon, label, size = 22, color = colors.ink, style, badge, ...rest }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} item${badge === 1 ? '' : 's'}` : label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }, style]}
      {...rest}
    >
      <Feather name={icon} size={size} color={color} />
      {badge ? (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HeartButton({ active, onPress, label, style }: { active: boolean; onPress: () => void; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `Remove ${label} from wishlist` : `Add ${label} to wishlist`}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }, style]}
    >
      <Ionicons name={active ? 'heart' : 'heart-outline'} size={21} color={active ? colors.green : colors.ink} />
    </Pressable>
  );
}

/* ---------- Chips ---------- */

export function Chip({ label, selected, onPress, count }: { label: string; selected?: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && !selected && { backgroundColor: colors.cream }]}
    >
      <Text maxFontSizeMultiplier={1.6} style={[styles.chipText, selected && { color: colors.white }]}>
        {label}
        {count != null ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

/* ---------- Layout ---------- */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <H2 style={{ flex: 1 }}>{title}</H2>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="link" accessibilityLabel={`${action}: ${title}`} style={styles.linkTarget}>
          <Label style={styles.underline}>{action}</Label>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextLink({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={title} style={[styles.linkTarget, style]}>
      <Label style={styles.underline}>{title}</Label>
    </Pressable>
  );
}

/* ---------- Forms ---------- */

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, style, ...rest }, ref) {
  return (
    <View style={styles.field}>
      <Label style={{ color: colors.inkSoft, marginBottom: space.xs }}>{label}</Label>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.muted}
        style={[styles.input, !!error && { borderColor: colors.danger }, style]}
        {...rest}
      />
      {error ? (
        <Small style={{ color: colors.danger, marginTop: space.xxs }} accessibilityLiveRegion="polite">
          {error}
        </Small>
      ) : hint ? (
        <Small style={{ marginTop: space.xxs }}>{hint}</Small>
      ) : null}
    </View>
  );
});

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Body>{label}</Body>
        {description ? <Small>{description}</Small> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ true: colors.green, false: colors.hairline }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.hairline}
      />
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorNote} accessibilityRole="alert">
      <Small style={{ color: colors.danger, flex: 1 }}>{message}</Small>
      {onRetry ? <TextLink title="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body, action, onAction }: { title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <H2 style={{ textAlign: 'center' }}>{title}</H2>
      {body ? <Body style={{ textAlign: 'center', color: colors.inkSoft, marginTop: space.sm }}>{body}</Body> : null}
      {action && onAction ? <Button title={action} onPress={onAction} style={{ marginTop: space.lg, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[strong ? type.price : type.body, { flex: 1 }]}>{label}</Text>
      <Text style={strong ? [type.price, { fontSize: 16 }] : type.body}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderWidth: hairline,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: minTouch, paddingHorizontal: space.md },
  buttonInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  iconButton: { minWidth: minTouch, minHeight: minTouch, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontFamily: fonts.sansSemiBold, fontSize: 9 },
  chip: {
    minHeight: minTouch - 8,
    marginVertical: 4,
    paddingHorizontal: space.md,
    borderWidth: hairline,
    borderColor: colors.hairline,
    borderRadius: radius,
    justifyContent: 'center',
    marginRight: space.xs,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.ink },
  divider: { height: hairline, backgroundColor: colors.hairline },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.md },
  linkTarget: { minHeight: minTouch, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  field: { marginBottom: space.md },
  input: {
    minHeight: 50,
    borderWidth: hairline,
    borderColor: colors.hairline,
    borderRadius: radius,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space.xs },
  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: hairline,
    borderColor: colors.danger,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginVertical: space.sm,
  },
  empty: { paddingHorizontal: space.lg, paddingVertical: space.xxl, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: space.xs },
});
