import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query(): MediaQueryList | null {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

function subscribe(onChange: () => void): () => void {
  const list = query();
  list?.addEventListener?.('change', onChange);
  return () => list?.removeEventListener?.('change', onChange);
}

/**
 * Whether the reader asked for no motion. The server and the first client
 * render answer false, so they match; the real answer follows the hydration.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches === true,
    () => false,
  );
}
