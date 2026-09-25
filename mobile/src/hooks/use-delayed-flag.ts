import { useEffect, useState } from 'react';

/**
 * True only once `active` has stayed true for `delayMs`.
 * Fast requests never flash a loader, and nothing is artificially delayed:
 * the flag drops the moment `active` becomes false.
 */
export function useDelayedFlag(active: boolean, delayMs = 250): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return active && shown;
}
