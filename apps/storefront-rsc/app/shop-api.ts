/**
 * Typed access to `apps/shop-api`, and nothing more than that.
 *
 * The types are this app's own, per the demo spec: the API is the contract and
 * no package exists to share response shapes. Nothing here is a loader -- every
 * widget calls these itself, during its own render, which is the distinction
 * this app exists to show.
 */

/** Whether a title can be bought, and why not when it cannot. */
export type Availability =
  'in-stock' | 'preorder' | 'reprint-pending' | 'out-of-print';

/** An expansion, identified by a composite-NSS `urn:expansion:game:slug`. */
export interface Expansion {
  urn: string;
  title: string;
  /** Minor units, SEK öre. */
  price: number;
}

/** One catalogue entry, as `GET /games` and `GET /games/:urn` return it. */
export interface Game {
  /** Entity identity, e.g. `urn:game:wingspan`. */
  urn: string;
  title: string;
  /** Most characteristic mechanism first; that one carries the title's hue. */
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  weight: number;
  /** Minor units, SEK öre. */
  price: number;
  /**
   * What the shop says about buying it. A separate fact from stock: a title can be
   * listed in stock and sit at zero copies, and the inventory endpoint is what
   * knows the copies.
   */
  availability: Availability;
  expansions: Expansion[];
}

/** Stock for one game, as `GET /inventory/:urn` returns it. */
export interface Stock {
  urn: string;
  quantity: number;
  /** The id shop-api saw for the request that read this. */
  correlationId?: string;
}

/** One event from shop-api's in-memory sink, as `GET /telemetry` returns it. */
export interface TelemetryEvent {
  id: number;
  timestamp: string;
  correlationId: string | undefined;
  source: string;
  type: string;
}

/**
 * Where shop-api listens, including its global `api` prefix.
 *
 * Read from the environment so the demo can point at a shop-api on another
 * port, and defaulted so `nx serve shop-api` plus `nx dev storefront-rsc` is
 * the whole setup.
 */
const SHOP_API = process.env.SHOP_API_URL ?? 'http://localhost:3000/api';

/**
 * `cache: 'no-store'` on every request: stock changes, and a cached response
 * would let a page claim a game is available after it has sold out. It is also
 * what keeps this route out of the build -- a fetch Next cannot cache makes the
 * page dynamic, so `next build` never calls shop-api and the build does not
 * need it running.
 */
export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${SHOP_API}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`GET ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * A urn is one path segment containing colons. They are legal there unencoded,
 * but Express decodes the parameter either way, so encoding is the form that
 * also survives an nss with a reserved character in it.
 */
export const urnPath = (urn: string): string => encodeURIComponent(urn);
