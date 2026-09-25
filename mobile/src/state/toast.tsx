import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, minTouch, radius, space } from '@/theme';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, opts?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, opts?: ToastOptions) => {
    setToast({ id: Date.now(), message, ...opts });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
    }, 3200);
    return () => clearTimeout(t);
  }, [toast, opacity]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72, opacity }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Text style={styles.text}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                style={styles.action}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md },
  toast: {
    backgroundColor: colors.ink,
    borderRadius: radius,
    paddingHorizontal: space.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { color: colors.white, fontFamily: fonts.sans, fontSize: 14, flex: 1, paddingVertical: space.sm },
  action: { minHeight: minTouch, justifyContent: 'center', paddingLeft: space.md },
  actionText: { color: colors.cream, fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
});
