import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { track } from './analytics';
import { api } from './api';
import { routeForUrl } from './deeplinks';

/** Foreground presentation: show a banner, no sound/badge spam. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PushRegistration = { ok: true; token: string } | { ok: false; reason: 'denied' | 'simulator' | 'not_configured' | 'error'; message: string };

/**
 * Called ONLY when the user switches on a push preference — never at launch.
 * Requests OS permission, obtains the Expo push token and registers it with the API.
 */
export async function enablePushNotifications(): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator', message: 'Push notifications need a physical device.' };
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Order updates and news',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#153f32',
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    granted = req.granted;
  }
  if (!granted) {
    return { ok: false, reason: 'denied', message: 'Notifications are turned off for CNM Essentials. You can enable them in Settings.' };
  }
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { ok: false, reason: 'not_configured', message: 'Push is not configured for this build yet (missing EAS project ID).' };
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/account/push-token', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error)?.message ?? 'Could not register for notifications.' };
  }
}

function handleResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const data = response.notification.request.content.data as { url?: string; path?: string } | undefined;
  const route = routeForUrl(data?.url ?? data?.path ?? null);
  track('notification_open', { route: route ?? 'none' });
  if (route) router.push(route as never);
}

/** Routes notification taps (warm and cold start) through the same deep-link map. */
export function useNotificationDeepLinks() {
  useEffect(() => {
    let mounted = true;
    const last = Notifications.getLastNotificationResponse();
    if (last && mounted) {
      // Defer so the navigator is mounted before we push.
      setTimeout(() => handleResponse(last), 0);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}
