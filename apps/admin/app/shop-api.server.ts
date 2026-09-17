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
import type { Matrix } from '@evanion/acl';
import type { AdminSubject } from './access.js';

/** One entry of the games catalogue, as `GET /games` returns it. */
export interface Game {
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  /** Complexity, 1 (light) to 5 (heavy). */
  complexity: number;
  /** Slug of the shop that lists this title, e.g. `stockholm`. */
  shop: string;
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
 * The header shop-api's `SubjectMiddleware` reads, carrying the subject as JSON.
 *
 * Demo-grade on both ends: the back office states who it is and shop-api
 * believes it, because real authentication is out of scope for this chain. A
 * request that sends nothing usable runs there as an anonymous customer, so an
 * omitted header refuses rather than escalates.
 *
 * Sending it does not hand shop-api's answer any authority here. This app
 * fetches the contract and re-decides every loader and every action against it,
 * and shop-api re-decides the same request on its own copy.
 */
export const SUBJECT_HEADER = 'x-shop-subject';

/** The body `GET /policy` answers with: the contract, and its revision. */
export interface PolicyDocument {
  version: string | number | undefined;
  matrix: Matrix;
}

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

/**
 * The one place a request to shop-api is made, and therefore the one place the
 * correlation id and the subject are written onto it.
 */
async function get<T>(
  path: string,
  correlationId: string,
  subject: AdminSubject,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      headers: {
        [CORRELATION_HEADER]: correlationId,
        [SUBJECT_HEADER]: JSON.stringify(subject),
      },
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
export function listGames(
  correlationId: string,
  subject: AdminSubject,
): Promise<Game[]> {
  return get<Game[]>('/games', correlationId, subject);
}

/** Stock for one game. */
export function getStock(
  urn: string,
  correlationId: string,
  subject: AdminSubject,
): Promise<Stock> {
  return get<Stock>(`/inventory/${urn}`, correlationId, subject);
}

/**
 * The access matrix shop-api publishes.
 *
 * The document alone. What comes back is adopted with `parseMatrix` and
 * evaluated here; the answers shop-api would give are never asked for, because
 * an app that asked would have made a decision into a network call and would be
 * trusting the layer in front of it.
 */
export function getPolicy(
  correlationId: string,
  subject: AdminSubject,
): Promise<PolicyDocument> {
  return get<PolicyDocument>('/policy', correlationId, subject);
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
  subject: AdminSubject,
): Promise<Stock[]> {
  return Promise.all(urns.map((urn) => getStock(urn, correlationId, subject)));
}

/**
 * Recorded events, oldest first. `correlationId` filters to one request's trail.
 */
export function listTelemetry(
  correlationId: string,
  subject: AdminSubject,
  forCorrelationId?: string,
): Promise<TelemetryEvent[]> {
  const query = forCorrelationId
    ? `?correlationId=${encodeURIComponent(forCorrelationId)}`
    : '';
  return get<TelemetryEvent[]>(`/telemetry${query}`, correlationId, subject);
}

/**
 * A fresh correlation id for one page view, prefixed so an id originating in the
 * back office is distinguishable from one the storefront or a bare curl started.
 */
export function newCorrelationId(): string {
  return `admin-${crypto.randomUUID().slice(0, 8)}`;
}
