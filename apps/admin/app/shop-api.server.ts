/**
 * Typed client for `apps/shop-api`, used only from route loaders.
 *
 * The response shapes are declared here rather than imported from the Nest app.
 * The API is the contract: a back office that compiled against the server's own
 * interfaces would be checked against the implementation instead of against
 * what crosses the wire, and shop-api would become a build dependency of every
 * app that reads it.
 *
 * `.server.ts` is enforced by the React Router vite plugin: importing this
 * module from anything that reaches the browser bundle is a build error, which
 * is what keeps the API base URL and the fetch calls out of client code.
 */

/** One entry of the games catalogue, as `GET /games` returns it. */
export interface Game {
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  weight: number;
}

/** Stock for one game, as `GET /inventory/:urn` returns it. */
export interface Stock {
  urn: string;
  quantity: number;
  /** The correlation id the inventory endpoint saw on this request. */
  correlationId?: string;
}

/** One event from the observability sink, as `GET /telemetry` returns it. */
export interface TelemetryEvent {
  id: number;
  timestamp: string;
  correlationId?: string;
  source: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Where shop-api is listening.
 *
 * Read per call rather than at module scope, so a deployment that sets
 * `SHOP_API_URL` after this module is first imported still picks it up, and so a
 * test can set it between cases.
 */
function baseUrl(): string {
  return process.env['SHOP_API_URL'] ?? 'http://localhost:3000/api';
}

/**
 * The header `@evanion/nestjs-correlation-id` reads on the way in and echoes on
 * the way out. Sending one from here is what puts a page view at the head of the
 * trail shop-api records, rather than having the server mint an id the admin
 * never learns.
 */
export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Raised when shop-api cannot be reached or answers with a non-2xx.
 *
 * A distinct class, because a back office whose API is down has to render an
 * empty state that says so. An unhandled fetch rejection would instead surface
 * as the route's error boundary, which tells the operator nothing actionable.
 */
export class ShopApiUnavailable extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`shop-api ${path}: ${reason}`);
    this.name = 'ShopApiUnavailable';
  }
}

async function get<T>(path: string, correlationId: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      headers: { [CORRELATION_HEADER]: correlationId },
    });
  } catch (cause) {
    throw new ShopApiUnavailable(
      path,
      cause instanceof Error ? cause.message : 'request failed',
    );
  }
  if (!response.ok) {
    throw new ShopApiUnavailable(path, `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The whole catalogue. */
export function listGames(correlationId: string): Promise<Game[]> {
  return get<Game[]>('/games', correlationId);
}

/** Stock for one game. */
export function getStock(urn: string, correlationId: string): Promise<Stock> {
  return get<Stock>(`/inventory/${urn}`, correlationId);
}

/**
 * Stock for every game, in catalogue order.
 *
 * One request per game, issued concurrently. shop-api exposes stock per urn and
 * no bulk endpoint, and inventing a client-side batch would mean the admin
 * guessing at a contract the API does not offer. Concurrency is what keeps the
 * page a single round trip's worth of latency instead of N.
 */
export function getStockFor(
  urns: string[],
  correlationId: string,
): Promise<Stock[]> {
  return Promise.all(urns.map((urn) => getStock(urn, correlationId)));
}

/**
 * Recorded events, oldest first. `correlationId` filters to one request's trail.
 */
export function listTelemetry(
  correlationId: string,
  forCorrelationId?: string,
): Promise<TelemetryEvent[]> {
  const query = forCorrelationId
    ? `?correlationId=${encodeURIComponent(forCorrelationId)}`
    : '';
  return get<TelemetryEvent[]>(`/telemetry${query}`, correlationId);
}

/**
 * A fresh correlation id for one page view, prefixed so an id originating in the
 * back office is distinguishable from one the storefront or a bare curl started.
 */
export function newCorrelationId(): string {
  return `admin-${crypto.randomUUID().slice(0, 8)}`;
}
