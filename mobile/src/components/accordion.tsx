import Feather from '@expo/vector-icons/Feather';
import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { colors, hairline, space } from '@/theme';

import { Label } from './ui';

export function Accordion({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const reduceMotion = useReduceMotion();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={styles.header}
      >
        <Label style={{ flex: 1 }}>{title}</Label>
        <Feather name={open ? 'minus' : 'plus'} size={16} color={colors.ink} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: hairline, borderColor: colors.hairline },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
  body: { paddingBottom: space.lg },
});
