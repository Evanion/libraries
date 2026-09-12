/**
 * Typed client for `apps/shop-api`, and the place the correlation id crosses
 * from this process into that one.
 *
 * The response shapes are declared here rather than imported from the API:
 * the HTTP contract is the boundary, and a shared types package between two
 * demo apps would hide a breaking change behind a compile that still passes.
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

/** One catalogue entry, as `GET /games` returns it. */
export interface Game {
  urn: string;
  title: string;
  /** Most characteristic mechanism first; that one carries the title's hue. */
  mechanisms: string[];
  players: string;
  playtime: string;
  weight: number;
  /** Minor units, SEK öre. */
  price: number;
  availability: Availability;
  expansions: Expansion[];
}

/** Stock for one urn, as `GET /inventory/:urn` returns it. */
export interface Stock {
  urn: string;
  quantity: number;
  /** The id the inventory endpoint saw, echoed back in the body. */
  correlationId?: string;
}

/** A confirmed order, as `POST /orders` returns it. */
export interface Order {
  urn: string;
  items: { urn: string; quantity: number }[];
  correlationId?: string;
  /** One per cart line, from the API's own orders -> inventory hop. */
  inventoryCorrelationIds: (string | undefined)[];
}

/**
 * Either a response or a reason there is none.
 *
 * A union rather than a thrown error because the shop-api is a separate process
 * a reader may simply not have started, and a page that renders "start the API"
 * is more use than a 500.
 */
export type Result<T> =
  { ok: true; value: T } | { ok: false; status: number; error: string };

/**
 * The header the id travels in, matching
 * `@evanion/nestjs-correlation-id`'s `CORRELATION_ID_HEADER` default. Spelled
 * out rather than imported: the storefront is an HTTP client of that service,
 * not a consumer of its Nest package.
 */
export const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * The same shape `DEFAULT_CORRELATION_ID_VALIDATOR` accepts on the API side.
 * An inbound id that fails it is replaced rather than forwarded, so nothing
 * attacker-controlled reaches a header or a log line.
 */
const VALID_CORRELATION_ID = /^[\w.:-]{1,128}$/;

/** Where the API is, overridable for a non-default port. */
const DEFAULT_BASE_URL = 'http://localhost:3000/api';

function baseUrlFromEnv(): string {
  return process.env.SHOP_API_URL ?? DEFAULT_BASE_URL;
}

/** What a page needs to show the reader that the id crossed the hop. */
export interface CorrelationTrace {
  /** The id this page view sent on every outbound request. */
  sent: string;
  /** The distinct ids the API echoed back in its response headers. */
  echoed: string[];
  /** How many requests this page view made. */
  calls: number;
}

/**
 * One instance per request, created by `src/middleware.ts` and read off
 * `Astro.locals`.
 *
 * Per-request and not a module singleton because the correlation id is the
 * instance's identity: a shared client would mix two readers' page views into
 * one trace.
 */
export class ShopApi {
  private readonly echoed = new Set<string>();
  private calls = 0;

  constructor(
    readonly correlationId: string,
    private readonly baseUrl: string = baseUrlFromEnv(),
  ) {}

  /**
   * Continues the caller's trace when it sent a usable id, and starts one
   * otherwise.
   *
   * Reusing an inbound id is what lets `curl -H 'X-Correlation-Id: …'` pin the
   * id for a whole page view and then find it again in the API's telemetry.
   */
  static forRequest(request: Request, baseUrl?: string): ShopApi {
    const inbound = request.headers.get(CORRELATION_HEADER);
    const id =
      inbound && VALID_CORRELATION_ID.test(inbound)
        ? inbound
        : crypto.randomUUID();
    return new ShopApi(id, baseUrl);
  }

  /** The whole catalogue. */
  games(): Promise<Result<Game[]>> {
    return this.request<Game[]>('GET', '/games');
  }

  /**
   * One game.
   *
   * @param urn The full urn, `urn:game:azul`. Percent-encoded on the way out:
   * a colon is legal in a path segment but `encodeURIComponent` is what keeps a
   * slash or a space in a malformed urn from changing which route is hit.
   */
  game(urn: string): Promise<Result<Game>> {
    return this.request<Game>('GET', `/games/${encodeURIComponent(urn)}`);
  }

  /** Live stock for one urn. Its body carries the id the API saw. */
  stock(urn: string): Promise<Result<Stock>> {
    return this.request<Stock>('GET', `/inventory/${encodeURIComponent(urn)}`);
  }

  /** Places the order. The API validates every line against live stock. */
  createOrder(
    items: { urn: string; quantity: number }[],
  ): Promise<Result<Order>> {
    return this.request<Order>('POST', '/orders', { items });
  }

  /** What this page view sent, and what came back. */
  trace(): CorrelationTrace {
    return {
      sent: this.correlationId,
      echoed: [...this.echoed],
      calls: this.calls,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Result<T>> {
    this.calls += 1;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          [CORRELATION_HEADER]: this.correlationId,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      // Status 0: there was no response, so no status to report. The reader
      // needs to know the API is not answering, which is a different problem
      // from one it answered with.
      return {
        ok: false,
        status: 0,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }

    const echoed = response.headers.get(CORRELATION_HEADER);
    if (echoed) this.echoed.add(echoed);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: await errorMessage(response),
      };
    }

    return { ok: true, value: (await response.json()) as T };
  }
}

/** Nest's exception filter writes `{ message }`; anything else falls back. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join(', ');
  } catch {
    // A non-JSON error body is not worth surfacing verbatim.
  }
  return response.statusText || `HTTP ${response.status}`;
}
