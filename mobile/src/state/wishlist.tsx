import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { itemParams, track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { Product } from '@/lib/types';
import { dedupe, mergeWishlists, wishlistReducer } from '@/lib/wishlist';

import { useAuth } from './auth';
import { useToast } from './toast';

interface WishlistContextValue {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (product: Product) => void;
  remove: (id: string) => void;
  add: (product: Product) => void;
  syncing: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Guests: persisted in AsyncStorage.
 * Signed in: optimistic local update, then PUT /api/account/wishlist; reverted on failure.
 * On sign-in the guest list is merged server-side with ?merge=1.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { status, token } = useAuth();
  const toast = useToast();
  const [ids, dispatch] = useReducer(wishlistReducer, []);
  const idsRef = useRef<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const lastToken = useRef<string | null>(null);

  idsRef.current = ids;

  useEffect(() => {
    readJSON<string[]>(KEYS.wishlist, []).then((saved) => {
      dispatch({ type: 'hydrate', ids: [...idsRef.current, ...(Array.isArray(saved) ? saved : [])] });
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(KEYS.wishlist, ids);
  }, [ids, hydrated]);

  // Sign-in merge / sign-out clear.
  useEffect(() => {
    if (status === 'restoring' || !hydrated) return;
    const prev = lastToken.current;
    lastToken.current = token;
    if (token && token !== prev) {
      (async () => {
        setSyncing(true);
        try {
          const res = await api<{ items: string[] }>('/api/account/wishlist?merge=1', {
            method: 'PUT',
            body: { items: idsRef.current },
          });
          dispatch({ type: 'hydrate', ids: dedupe(res.items ?? idsRef.current) });
        } catch {
          try {
            const res = await api<{ items: string[] }>('/api/account/wishlist');
            dispatch({ type: 'hydrate', ids: mergeWishlists(idsRef.current, res.items ?? []) });
          } catch {
            // Offline: keep the local list; it will be merged on the next successful sign-in sync.
          }
        } finally {
          setSyncing(false);
        }
      })();
    } else if (!token && prev) {
      // Signed out: don't leave the account's wishlist on a shared device.
      dispatch({ type: 'hydrate', ids: [] });
    }
  }, [status, token, hydrated]);

  const push = useCallback(
    async (next: string[], previous: string[]) => {
      if (!token) return;
      try {
        await api('/api/account/wishlist', { method: 'PUT', body: { items: next } });
      } catch {
        dispatch({ type: 'hydrate', ids: previous });
        toast('Couldn’t update your wishlist. Please try again.');
      }
    },
    [token, toast],
  );

  const apply = useCallback(
    (action: { type: 'add' | 'remove' | 'toggle'; id: string }) => {
      const previous = idsRef.current;
      const next = wishlistReducer(previous, action);
      if (next === previous) return next;
      dispatch({ type: 'hydrate', ids: next });
      push(next, previous);
      return next;
    },
    [push],
  );

  const toggle = useCallback(
    (product: Product) => {
      const adding = !idsRef.current.includes(product.id);
      apply({ type: 'toggle', id: product.id });
      track(adding ? 'add_to_wishlist' : 'remove_from_wishlist', itemParams(product));
    },
    [apply],
  );

  const add = useCallback(
    (product: Product) => {
      if (idsRef.current.includes(product.id)) return;
      apply({ type: 'add', id: product.id });
      track('add_to_wishlist', itemParams(product));
    },
    [apply],
  );

  const remove = useCallback((id: string) => void apply({ type: 'remove', id }), [apply]);
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const value = useMemo(() => ({ ids, has, toggle, remove, add, syncing }), [ids, has, toggle, remove, add, syncing]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
