/**
 * The cart, as a cookie.
 *
 * No session store and no database, per the demo's scope: the cart is the only
 * state the storefront keeps, and a cookie is enough for it. Prices are not in
 * here -- a stored price is a price that can go stale -- so every total is
 * recomputed from the catalogue on the request that renders it.
 */

/** One cart line: what, and how many. */
export interface CartLine {
  /** A game or expansion urn. */
  urn: string;
  quantity: number;
}

export const CART_COOKIE = 'baize_cart';

/** Cap per line, so a hand-edited form cannot ask for ten thousand copies. */
const MAX_QUANTITY = 99;

/**
 * Reads a cart out of whatever the cookie held.
 *
 * Total of everything unrecognised: the cookie is client-side and a reader can
 * edit it, so a malformed entry is dropped rather than trusted or thrown on.
 */
export function parseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];

  const lines: CartLine[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { urn, quantity } = entry as Record<string, unknown>;
    if (typeof urn !== 'string' || urn === '') continue;
    const clamped = clampQuantity(quantity);
    if (clamped === 0) continue;
    lines.push({ urn, quantity: clamped });
  }
  return lines;
}

/**
 * The cart the request's cookies hold.
 *
 * Typed structurally against what it needs rather than against Astro's
 * `AstroCookies`, which keeps this module testable without an Astro request.
 * `json()` throws on a cookie a reader has hand-edited into invalid JSON, and an
 * unreadable cart is an empty one rather than a 500.
 */
export function readCart(cookies: {
  get(name: string): { json(): unknown } | undefined;
}): CartLine[] {
  try {
    return parseCart(cookies.get(CART_COOKIE)?.json());
  } catch {
    return [];
  }
}

/**
 * Adds copies of `urn`, merging into an existing line rather than appending a
 * second one for the same thing.
 */
export function addLine(
  lines: readonly CartLine[],
  urn: string,
  quantity: number,
): CartLine[] {
  const add = clampQuantity(quantity);
  if (add === 0) return [...lines];

  const existing = lines.find((line) => line.urn === urn);
  if (!existing) return [...lines, { urn, quantity: add }];

  return lines.map((line) =>
    line.urn === urn
      ? { urn, quantity: clampQuantity(line.quantity + add) }
      : line,
  );
}

/** Sets a line's quantity. Zero removes the line, which is what a cart does. */
export function setQuantity(
  lines: readonly CartLine[],
  urn: string,
  quantity: number,
): CartLine[] {
  const next = clampQuantity(quantity);
  if (next === 0) return removeLine(lines, urn);

  return lines.map((line) =>
    line.urn === urn ? { urn, quantity: next } : line,
  );
}

export function removeLine(
  lines: readonly CartLine[],
  urn: string,
): CartLine[] {
  return lines.filter((line) => line.urn !== urn);
}

/** Total copies, which is what the header's cart count shows. */
export function cartSize(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * A whole number of copies between 0 and {@link MAX_QUANTITY}.
 *
 * Accepts the string a form field produces as well as a number, because both
 * reach this from the same cart code path.
 */
function clampQuantity(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.trunc(parsed), 0), MAX_QUANTITY);
}
