/**
 * Typed access to `apps/shop-api`, and nothing more than that.
 *
 * The types are this app's own, per the demo spec: the API is the contract and
 * no package exists to share response shapes. Nothing here is a loader -- every
 * widget calls these itself, during its own render, which is the distinction
 * this app exists to show.
 */

import { cache } from 'react';
import { randomUUID } from 'node:crypto';

import { currentSubject, SHOP_SUBJECT_HEADER } from './subject';

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
  complexity: number;
  /** Minor units, SEK öre. */
  price: number;
  /**
   * What the shop says about buying it. A separate fact from stock: a title can be
   * listed in stock and sit at zero copies, and the inventory endpoint is what
   * knows the copies.
   */
  availability: Availability;
  /** Slug of the shop that lists this title, e.g. `stockholm`. */
  shop: string;
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
 * `@evanion/nestjs-correlation-id`'s `CORRELATION_ID_HEADER` default, spelled
 * the way shop-api's middleware reads it.
 */
export const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * One id for every request this page view makes, minted on the first one.
 *
 * Without it shop-api mints an id per request, and the six calls behind one page
 * carry six unrelated ids: the activity widget then lists the spotlight's own
 * stock check as though a stranger had asked for it. `cache` is what scopes the
 * id to the page view, so a second visitor's requests carry a different one.
 */
const correlationId = cache((): string => randomUUID());

/**
 * `cache: 'no-store'` on every request: stock changes, and a cached response
 * would let a page claim a game is available after it has sold out. It is also
 * what keeps this route out of the build -- a fetch Next cannot cache makes the
 * page dynamic, so `next build` never calls shop-api and the build does not
 * need it running.
 *
 * Every call states who it is for. shop-api resolves its own subject from this
 * header and re-decides the request against its own copy of the matrix, so the
 * widget that decided to render a section and the service that answers it reach
 * the same verdict independently. A widget that skipped its gate would still be
 * refused at the service.
 */
export async function fetchJson<T>(path: string): Promise<T> {
  const subject = await currentSubject();
  const response = await fetch(`${SHOP_API}${path}`, {
    cache: 'no-store',
    headers: {
      [SHOP_SUBJECT_HEADER]: JSON.stringify(subject),
      [CORRELATION_HEADER]: correlationId(),
    },
  });
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
