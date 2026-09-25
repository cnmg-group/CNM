import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { colors, hairline, radius, space } from '@/theme';

import { H3, IconButton } from './ui';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <H3 accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </H3>
            <IconButton icon="x" label={`Close ${title}`} onPress={onClose} />
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, maxHeight: '88%', borderTopLeftRadius: radius, borderTopRightRadius: radius },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.md,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    borderBottomWidth: hairline,
    borderColor: colors.hairline,
  },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: hairline, borderColor: colors.hairline },
});
