import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { api } from '@/lib/api';
import { bundledCatalogue, isCatalogue, mergeLive } from '@/lib/catalogue';
import { KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { Catalogue, Commerce, LiveCatalogue, Store } from '@/lib/types';

import commerceJson from '../data/commerce.json';
import storesJson from '../data/stores.json';

export const commerce = commerceJson as unknown as Commerce;
export const stores = storesJson as unknown as Store[];

type Source = 'bundled' | 'cache' | 'network';

interface State {
  catalogue: Catalogue;
  source: Source;
  /** True until we have either a cached or a network catalogue (drives skeletons). */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

type Action =
  | { type: 'cache'; catalogue: Catalogue }
  | { type: 'fetchStart' }
  | { type: 'fetchOk'; catalogue: Catalogue }
  | { type: 'fetchFail'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'cache':
      return state.source === 'network' ? state : { ...state, catalogue: action.catalogue, source: 'cache', loading: false };
    case 'fetchStart':
      return { ...state, refreshing: true, error: null };
    case 'fetchOk':
      return { catalogue: action.catalogue, source: 'network', loading: false, refreshing: false, error: null };
    case 'fetchFail':
      // Fall back to whatever we have (cache or the bundled copy) — never a blank shop.
      return { ...state, loading: false, refreshing: false, error: action.error };
    default:
      return state;
  }
}

interface CatalogueContextValue extends State {
  commerce: Commerce;
  stores: Store[];
  refresh: () => Promise<void>;
}

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    catalogue: bundledCatalogue,
    source: 'bundled',
    loading: true,
    refreshing: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    dispatch({ type: 'fetchStart' });
    try {
      const [staticResult, liveResult] = await Promise.allSettled([
        api<Catalogue>('/catalogue.json', { auth: false }),
        api<LiveCatalogue>('/api/catalogue/live', { auth: false }),
      ]);
      const base =
        staticResult.status === 'fulfilled' && isCatalogue(staticResult.value)
          ? staticResult.value
          : (await readJSON<Catalogue | null>(KEYS.catalogue, null)) ?? bundledCatalogue;
      const live = liveResult.status === 'fulfilled' ? liveResult.value : null;
      if (staticResult.status === 'rejected' && !live) throw staticResult.reason;
      const merged = mergeLive(base, live);
      dispatch({ type: 'fetchOk', catalogue: merged });
      if (staticResult.status === 'fulfilled') writeJSON(KEYS.catalogue, staticResult.value);
    } catch (e) {
      dispatch({ type: 'fetchFail', error: (e as Error)?.message ?? 'offline' });
    }
  }, []);

  useEffect(() => {
    readJSON<Catalogue | null>(KEYS.catalogue, null).then((cached) => {
      if (cached && isCatalogue(cached)) dispatch({ type: 'cache', catalogue: cached });
    });
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, commerce, stores, refresh }), [state, refresh]);
  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue() {
  const ctx = useContext(CatalogueContext);
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return ctx;
}
