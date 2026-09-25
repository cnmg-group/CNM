import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { colors } from '@/theme';

import { Small } from './ui';

/** Right wing, drawn in a 24×32 box; the left wing is the same path mirrored. */
const WING = 'M1 15 C 1 4, 21 -1, 22 9 C 23 16, 12 18, 1 15 Z M1 17 C 8 18, 18 22, 15 29 C 12 34, 2 27, 1 17 Z';

interface Props {
  /** Pass the raw "request in flight" boolean; the ~250ms threshold is handled here. */
  pending: boolean;
  label?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Show immediately (skip the threshold) — only for full-screen waits already known to be slow. */
  immediate?: boolean;
}

/**
 * CNM butterfly loader: two wings drift toward each other and merge like a
 * droplet, then part again. Rendered ONLY when a request is still pending
 * after ~250ms. With Reduce Motion on, it shows a static butterfly that fades in.
 */
export function ButterflyLoader({ pending, label = 'Loading', size = 36, color = colors.charcoal, style, immediate }: Props) {
  const visible = useDelayedFlag(pending, immediate ? 0 : 250);
  if (!visible) return null;
  return <ButterflyMark label={label} size={size} color={color} style={style} />;
}

export function ButterflyMark({ label, size = 36, color = colors.charcoal, style }: { label?: string; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: reduceMotion ? 400 : 200, useNativeDriver: true }).start();
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(t, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(160),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t, fade]);

  const wingW = size * 0.5;
  const wingH = size * 0.66;
  const spread = size * 0.14;

  // Wings start apart, then slide in until they overlap at the centre line.
  const leftX = t.interpolate({ inputRange: [0, 1], outputRange: [-spread - wingW / 2, wingW * 0.38 - wingW / 2] });
  const rightX = t.interpolate({ inputRange: [0, 1], outputRange: [spread + wingW / 2, wingW / 2 - wingW * 0.38] });
  const leftRot = t.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '0deg'] });
  const rightRot = t.interpolate({ inputRange: [0, 1], outputRange: ['10deg', '0deg'] });
  const squash = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.7, 0.35] });
  const squashMirrored = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [-1, -0.7, -0.35] });
  const wingOpacity = t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.85, 0] });
  const dropScale = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 0.5, 1] });
  const dropOpacity = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.2, 1] });

  return (
    <Animated.View
      style={[styles.wrap, { opacity: fade }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <View style={{ width: size * 1.4, height: wingH, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            styles.abs,
            { opacity: wingOpacity, transform: [{ translateX: leftX }, { rotate: leftRot }, { scaleX: squashMirrored }] },
          ]}
        >
          <Svg width={wingW} height={wingH} viewBox="0 0 24 32">
            <Path d={WING} fill={color} />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[styles.abs, { opacity: wingOpacity, transform: [{ translateX: rightX }, { rotate: rightRot }, { scaleX: squash }] }]}
        >
          <Svg width={wingW} height={wingH} viewBox="0 0 24 32">
            <Path d={WING} fill={color} />
          </Svg>
        </Animated.View>
        {/* The droplet the wings merge into */}
        <Animated.View style={[styles.abs, { opacity: dropOpacity, transform: [{ scale: dropScale }] }]}>
          <Svg width={size * 0.42} height={size * 0.56} viewBox="0 0 20 26">
            <Path d="M10 0 C 10 0, 20 12, 20 17 A 10 9 0 0 1 0 17 C 0 12, 10 0, 10 0 Z" fill={color} />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Centered block variant used in screens and sheets. */
export function PendingBlock({ pending, label, message }: { pending: boolean; label?: string; message?: string }) {
  const visible = useDelayedFlag(pending, 250);
  if (!visible) return null;
  return (
    <View style={styles.block}>
      <ButterflyMark label={label ?? message ?? 'Loading'} />
      {message ? <Small style={{ marginTop: 12, textAlign: 'center' }}>{message}</Small> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  block: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
});
