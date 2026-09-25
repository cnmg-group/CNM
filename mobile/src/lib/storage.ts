import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  bag: 'cnm.bag.v1',
  wishlist: 'cnm.wishlist.v1',
  recentSearches: 'cnm.search.recent.v1',
  recentlyViewed: 'cnm.recentlyViewed.v1',
  catalogue: 'cnm.catalogue.cache.v1',
  biometricEnabled: 'cnm.biometric.enabled.v1',
  checkoutContact: 'cnm.checkout.contact.v1',
} as const;

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is best-effort; the in-memory state stays authoritative for the session.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
