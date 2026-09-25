import { Platform } from 'react-native';

import { api } from './api';
import { APP_VERSION } from './config';

/**
 * GA4-style event names so web and app funnels line up in /api/admin/analytics.
 * https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */
export type EventName =
  | 'screen_view'
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'payment_failed'
  | 'search'
  | 'view_search_results'
  | 'add_to_wishlist'
  | 'remove_from_wishlist'
  | 'share'
  | 'login'
  | 'sign_up'
  | 'apply_promo'
  | 'notification_open';

export type EventParams = Record<string, string | number | boolean | null | undefined | object>;

/** Fire-and-forget. Never throws, never blocks UI, never shows a loader. */
export function track(name: EventName, params: EventParams = {}): void {
  api('/api/events', {
    method: 'POST',
    body: { name, params: { ...params, platform: Platform.OS, app_version: APP_VERSION, client: 'mobile' } },
    timeoutMs: 8000,
  }).catch(() => {
    // Analytics must never affect the shopping experience.
  });
}

export function itemParams(p: { id: string; name: string; category: string; price: { amount: number } }, qty = 1) {
  return {
    currency: 'NGN',
    value: p.price.amount * qty,
    items: [{ item_id: p.id, item_name: p.name, item_category: p.category, price: p.price.amount, quantity: qty }],
  };
}
