import { cache } from 'react';
import { cookies } from 'next/headers';

/**
 * Who the current page view is rendered for.
 *
 * The type is this app's own, the way the shop-api response types in
 * `shop-api.ts` are: the API is the contract and no package exists to share a
 * shape. The members are the ones shop-api's matrix declares in its subject
 * schema, because every condition in the published document reads one of them.
 */
export interface ShopSubject {
  /** Stable identity of the actor, e.g. `staff:ada` or `anonymous`. */
  id: string;
  /** What the actor may do: `customer`, `operator`, `manager`. */
  roles: string[];
  /**
   * Slug of the shop the actor works for, e.g. `stockholm`.
   *
   * Empty for an actor who works for no shop. The matrix compares it against
   * `object.shop`, and an empty slug matches no title in the catalogue.
   */
  shop: string;
}

/**
 * The actor a page view with no usable subject cookie renders for.
 *
 * A visitor with no session is a shopper: the catalogue and the spotlight are
 * theirs to read, telemetry is not, and they work for no shop, so every rule
 * comparing `object.shop` against `subject.shop` refuses them.
 */
export const ANONYMOUS_SUBJECT: ShopSubject = {
  id: 'anonymous',
  roles: ['customer'],
  shop: '',
};

/**
 * Cookie carrying the demo subject, as the JSON shop-api's header takes:
 * `{"id":…,"roles":[…],"shop":…}`.
 *
 * A cookie rather than the header shop-api itself reads, because a browser sets
 * a cookie and cannot set a request header on a top-level navigation. Flipping
 * this demo between a shopper and a manager is one `document.cookie` write.
 */
export const SHOP_SUBJECT_COOKIE = 'shop-subject';

/** Header this app states the resolved subject on when it calls shop-api. */
export const SHOP_SUBJECT_HEADER = 'X-Shop-Subject';

/**
 * Whether a parsed cookie payload carries the three members a subject needs.
 *
 * The cookie is visitor-controlled text, so a payload that misses a member or
 * states one at the wrong type is discarded whole and the page view runs as
 * `ANONYMOUS_SUBJECT`. Repairing half of it would hand the matrix a subject
 * whose `shop` the visitor never stated.
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

/**
 * The subject `value` states, or `ANONYMOUS_SUBJECT` when it states none.
 *
 * `JSON.parse` throws on anything but JSON, so the throw is caught here and
 * answered with the anonymous subject.
 */
function subjectFrom(value: string | undefined): ShopSubject {
  if (!value) return ANONYMOUS_SUBJECT;
  try {
    const parsed: unknown = JSON.parse(value);
    return isShopSubject(parsed)
      ? { id: parsed.id, roles: [...parsed.roles], shop: parsed.shop }
      : ANONYMOUS_SUBJECT;
  } catch {
    return ANONYMOUS_SUBJECT;
  }
}

/**
 * The actor this page view decides against, resolved once for the whole render.
 *
 * Demo-grade. Real authentication is out of scope here: the subject arrives on
 * a cookie, nothing verifies a signature or a session, and any visitor can claim
 * any role. A deployment replaces the body of this function with one that reads
 * a verified session and leaves every caller unchanged, which is why the three
 * widgets and `shop-api.ts` all come through here rather than reading the cookie
 * themselves.
 *
 * `cache` scopes the result to one request. Three widgets render independently
 * and each asks for the subject; one `cookies()` read answers all three, and two
 * concurrent page views get their own. A module-level variable would be shared
 * by every request the server handles.
 */
export const currentSubject = cache(async (): Promise<ShopSubject> => {
  const store = await cookies();
  return subjectFrom(store.get(SHOP_SUBJECT_COOKIE)?.value);
});
