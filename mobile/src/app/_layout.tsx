// Per-weight subpath imports so only the five faces we use are bundled.
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler, useNotificationDeepLinks } from '@/lib/notifications';
import { AuthProvider } from '@/state/auth';
import { BagProvider } from '@/state/bag';
import { CatalogueProvider } from '@/state/catalogue';
import { RecentlyViewedProvider } from '@/state/recently-viewed';
import { ToastProvider } from '@/state/toast';
import { WishlistProvider } from '@/state/wishlist';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.charcoal, background: colors.white, card: colors.white, text: colors.ink, border: colors.hairline },
};

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function DeepLinkBridge() {
  useNotificationDeepLinks();
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // System fonts are an acceptable fallback if font loading fails; don't block the shop.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <ToastProvider>
            <CatalogueProvider>
              <AuthProvider>
                <WishlistProvider>
                  <BagProvider>
                    <RecentlyViewedProvider>
                      <StatusBar style="dark" />
                      <DeepLinkBridge />
                      <Stack
                        screenOptions={{
                          headerShadowVisible: false,
                          headerBackButtonDisplayMode: 'minimal',
                          headerTintColor: colors.ink,
                          headerTitleStyle: { fontFamily: fonts.serif, fontSize: 20 },
                          contentStyle: { backgroundColor: colors.white },
                        }}
                      >
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="products/[slug]" options={{ title: '' }} />
                        <Stack.Screen name="shop/[category]" options={{ headerShown: false }} />
                        <Stack.Screen name="collections/[collection]" options={{ headerShown: false }} />
                        <Stack.Screen name="bag" options={{ title: 'Bag' }} />
                        <Stack.Screen name="checkout/index" options={{ title: 'Checkout', gestureEnabled: false }} />
                        <Stack.Screen name="checkout/return" options={{ title: 'Payment', headerBackVisible: false, gestureEnabled: false }} />
                        <Stack.Screen name="account/sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
                        <Stack.Screen name="account/register" options={{ title: 'Create account', presentation: 'modal' }} />
                        <Stack.Screen name="account/reset" options={{ title: 'Reset password', presentation: 'modal' }} />
                        <Stack.Screen name="account/otp" options={{ title: 'Email me a code', presentation: 'modal' }} />
                        <Stack.Screen name="account/profile" options={{ title: 'Profile' }} />
                        <Stack.Screen name="account/addresses" options={{ title: 'Addresses' }} />
                        <Stack.Screen name="account/address-edit" options={{ title: 'Address', presentation: 'modal' }} />
                        <Stack.Screen name="account/orders/index" options={{ title: 'Orders' }} />
                        <Stack.Screen name="account/orders/[number]" options={{ title: 'Order' }} />
                        <Stack.Screen name="account/preferences" options={{ title: 'Notifications' }} />
                        <Stack.Screen name="account/security" options={{ title: 'Privacy & security' }} />
                      </Stack>
                    </RecentlyViewedProvider>
                  </BagProvider>
                </WishlistProvider>
              </AuthProvider>
            </CatalogueProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
