import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import { colors, space } from '@/theme';

/** Standard scrollable page with keyboard handling and consistent gutters. */
export function Screen({ children, contentContainerStyle, padded = true, ...rest }: ScrollViewProps & { children: ReactNode; padded?: boolean }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[padded && styles.padded, { paddingBottom: space.xxl }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  padded: { paddingHorizontal: space.md, paddingTop: space.lg },
});
