import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * The three providers the back office runs, kept apart from `ui/baize.tsx`.
 *
 * Every one of them needs `createContext` and two of them need `useState`, none
 * of which exists under React's `react-server` export condition. They are
 * app-local for that reason: the shared UI library has to be importable from a
 * React Server Component, so nothing in it may reach for these.
 *
 * React Router framework mode renders route modules isomorphically -- server
 * first, then hydrated on the client -- so a context provider works here exactly
 * as it would in a client-only app. That is the same fact that stops this app
 * from demonstrating a self-fetching widget; see the README.
 */

/** Who is signed in. Supplied by the shell route's loader, never by the client. */
export interface Session {
  operator: string;
  shop: string;
  /** Correlation id of the page view, so the UI can show what it traced. */
  correlationId: string;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children?: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * @throws {Error} when called outside `SessionProvider`. A back office with no
 * session is a bug in the provider array, not a state to render around.
 */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession was called outside SessionProvider');
  }
  return session;
}

/**
 * How tightly data is set. `compact` drops the row padding on long tables, which
 * is the only thing an operator scanning two hundred rows asks for.
 *
 * Not a light/dark switch: the ground is table baize and there is no second
 * ground. Theme here is density.
 */
export type Density = 'comfortable' | 'compact';

interface ThemeValue {
  density: Density;
  setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  initialDensity = 'comfortable',
  children,
}: {
  initialDensity?: Density;
  children?: ReactNode;
}) {
  const [density, setDensity] = useState<Density>(initialDensity);
  const value = useMemo(() => ({ density, setDensity }), [density]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Density, and the setter. Falls back to `comfortable` outside a provider. */
export function useDensity(): ThemeValue {
  return (
    useContext(ThemeContext) ?? {
      density: 'comfortable',
      setDensity: () => undefined,
    }
  );
}

/** A restock cart: how many copies of each title the buyer intends to reorder. */
export interface Restock {
  lines: Readonly<Record<string, number>>;
  units: number;
  add: (urn: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<Restock | null>(null);

/**
 * The buyer's restock cart.
 *
 * Client state and nothing else: a reorder is not submitted to shop-api, which
 * has no purchasing endpoint, so the cart is a working list the buyer builds
 * while reading the shelf. It resets on reload, which is the honest behaviour for
 * state that was never sent anywhere.
 */
export function CartProvider({ children }: { children?: ReactNode }) {
  const [lines, setLines] = useState<Record<string, number>>({});

  const add = useCallback((urn: string, quantity: number) => {
    setLines((current) => {
      const next = (current[urn] ?? 0) + quantity;
      if (next <= 0) {
        const { [urn]: _dropped, ...rest } = current;
        return rest;
      }
      return { ...current, [urn]: next };
    });
  }, []);

  const clear = useCallback(() => setLines({}), []);

  const value = useMemo<Restock>(
    () => ({
      lines,
      units: Object.values(lines).reduce((total, count) => total + count, 0),
      add,
      clear,
    }),
    [lines, add, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * @throws {Error} when called outside `CartProvider`, for the same reason
 * `useSession` does.
 */
export function useRestock(): Restock {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error('useRestock was called outside CartProvider');
  }
  return cart;
}
