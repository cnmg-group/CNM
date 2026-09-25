import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { itemParams, track } from '@/lib/analytics';
import { bagCount, bagReducer, EMPTY_BAG, maxQtyFor, type BagState } from '@/lib/cart';
import { findProduct } from '@/lib/catalogue';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { Product } from '@/lib/types';

import { useCatalogue } from './catalogue';

export type AddResult = { ok: true; capped: boolean } | { ok: false; reason: 'out_of_stock' | 'max_reached' };

interface BagContextValue extends BagState {
  count: number;
  hydrated: boolean;
  add: (product: Product, qty?: number) => AddResult;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  setPromo: (code: string | null) => void;
  clear: () => void;
  maxFor: (id: string) => number;
}

const BagContext = createContext<BagContextValue | null>(null);

export function BagProvider({ children }: { children: ReactNode }) {
  const { catalogue, commerce } = useCatalogue();
  const [state, dispatch] = useReducer(bagReducer, EMPTY_BAG);
  const hydrated = useRef(false);

  useEffect(() => {
    readJSON<BagState>(KEYS.bag, EMPTY_BAG).then((saved) => {
      hydrated.current = true;
      if (saved && Array.isArray(saved.lines)) dispatch({ type: 'hydrate', state: { lines: saved.lines, promoCode: saved.promoCode ?? null } });
    });
  }, []);

  useEffect(() => {
    if (hydrated.current) writeJSON(KEYS.bag, state);
  }, [state]);

  const maxFor = useCallback((id: string) => maxQtyFor(findProduct(catalogue, id), commerce), [catalogue, commerce]);

  const add = useCallback(
    (product: Product, qty = 1): AddResult => {
      const max = maxQtyFor(product, commerce);
      if (max <= 0) return { ok: false, reason: 'out_of_stock' };
      const current = state.lines.find((l) => l.id === product.id)?.qty ?? 0;
      if (current >= max) return { ok: false, reason: 'max_reached' };
      const added = Math.min(qty, max - current);
      dispatch({ type: 'add', id: product.id, qty: added, max });
      track('add_to_cart', itemParams(product, added));
      return { ok: true, capped: added < qty };
    },
    [commerce, state.lines],
  );

  const setQty = useCallback((id: string, qty: number) => dispatch({ type: 'setQty', id, qty, max: maxFor(id) }), [maxFor]);

  const remove = useCallback(
    (id: string) => {
      const p = findProduct(catalogue, id);
      const line = state.lines.find((l) => l.id === id);
      dispatch({ type: 'remove', id });
      if (p && line) track('remove_from_cart', itemParams(p, line.qty));
    },
    [catalogue, state.lines],
  );

  const setPromo = useCallback((code: string | null) => dispatch({ type: 'setPromo', code }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo(
    () => ({ ...state, count: bagCount(state.lines), hydrated: hydrated.current, add, setQty, remove, setPromo, clear, maxFor }),
    [state, add, setQty, remove, setPromo, clear, maxFor],
  );
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error('useBag must be used inside BagProvider');
  return ctx;
}
