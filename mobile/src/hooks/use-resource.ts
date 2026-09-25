import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { api, errorMessage } from '@/lib/api';

/** GET a JSON resource, refreshing whenever the screen regains focus. */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const res = await api<T>(path);
      if (id === seq.current) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, setData, loading, error, reload: load };
}
