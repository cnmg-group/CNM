import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairline, minTouch, radius, type } from '@/theme';

export function QtyStepper({ value, min = 1, max, onChange, label = 'Quantity' }: { value: number; min?: number; max: number; onChange: (v: number) => void; label?: string }) {
  const canDec = value > min;
  const canInc = value < max;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canInc) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && canDec) onChange(value - 1);
      }}
    >
      <Pressable
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={[styles.btn, !canDec && styles.disabled]}
      >
        <Feather name="minus" size={14} color={colors.ink} />
      </Pressable>
      <Text style={[type.price, styles.value]}>{value}</Text>
      <Pressable
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={[styles.btn, !canInc && styles.disabled]}
      >
        <Feather name="plus" size={14} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: hairline,
    borderColor: colors.hairline,
    borderRadius: radius,
    alignSelf: 'flex-start',
  },
  btn: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  value: { minWidth: 28, textAlign: 'center' },
});
