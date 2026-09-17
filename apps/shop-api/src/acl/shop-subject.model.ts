/**
 * The actor every decision in this app is made against.
 *
 * Demo-grade. Real authentication is out of scope here: the subject arrives on
 * the `X-Shop-Subject` header, nothing verifies a signature or a session, and
 * any caller can claim any role. A deployment replaces `SubjectMiddleware` with
 * one that reads a verified session and leaves the rest of this app unchanged,
 * because everything downstream reads `SubjectService.current()`.
 */
export interface ShopSubject {
  /** Stable identity of the actor, e.g. `staff:ada` or `anonymous`. */
  id: string;
  /** What the actor may do: `customer`, `operator`, `manager`. */
  roles: string[];
  /**
   * Slug of the shop the actor works for, e.g. `stockholm`.
   *
   * Empty for an actor who works for no shop, which is what the anonymous
   * subject carries. The matrix compares it against `object.shop`, and an empty
   * slug matches no title in the catalogue.
   */
  shop: string;
}

/**
 * The subject a request with no usable `X-Shop-Subject` header runs as.
 *
 * A browser with no session is a shopper: it reads the catalogue and places an
 * order, and it works for no shop, so every rule comparing `object.shop`
 * against `subject.shop` refuses it.
 */
export const ANONYMOUS_SUBJECT: ShopSubject = {
  id: 'anonymous',
  roles: ['customer'],
  shop: '',
};

/**
 * Whether a parsed header payload carries the three members a subject needs.
 *
 * The header is caller-controlled text, so a payload that misses a member or
 * states one at the wrong type is discarded whole and the request runs as
 * `ANONYMOUS_SUBJECT`. Repairing half of it would hand the matrix a subject
 * whose `shop` the caller never stated.
 */
export function isShopSubject(value: unknown): value is ShopSubject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['shop'] === 'string' &&
    Array.isArray(candidate['roles']) &&
    candidate['roles'].every((role) => typeof role === 'string')
  );
}
