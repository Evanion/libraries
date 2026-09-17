/**
 * The actor every decision in this app is made against, and the cookie it
 * arrives in.
 *
 * Demo-grade. Real authentication is out of scope here: nothing signs the
 * cookie and nothing verifies a session, so the identity is whatever the
 * browser last asked `/session` to set. A deployment replaces {@link readSubject}
 * with a read of a verified session and changes nothing else, because every
 * decision in this app reads the subject the middleware put on `Astro.locals`.
 *
 * The cookie is httpOnly for the reason the cart cookie is: this app runs no
 * JavaScript in the browser, so nothing on the page has a use for either value,
 * and a cookie script cannot read is a cookie an injected script cannot rewrite.
 */

/**
 * The actor: who, what they may do, and which shop they belong to.
 *
 * A type alias and not an interface, because `Access.can` takes the library's
 * `Subject`, which is `Record<string, unknown>`. TypeScript gives an alias of an
 * object type an implicit index signature and gives an interface none, so an
 * interface here would oblige every decision in this app to copy the subject
 * into a bag first.
 */
export type StorefrontSubject = {
  /** Stable identity, e.g. `customer:demo` or `anonymous`. */
  id: string;
  /** What the actor may do. The storefront issues `customer` and nothing else. */
  roles: string[];
  /**
   * Slug of the shop the actor works for, e.g. `stockholm`.
   *
   * Empty for a shopper, who works for no shop. The published matrix compares it
   * against `object.shop` on the staff permissions, and an empty slug matches no
   * title in the catalogue.
   */
  shop: string;
};

export const SUBJECT_COOKIE = 'baize_subject';

/**
 * The roles this app will hand on to the shop-api.
 *
 * The storefront turns a cookie into the `X-Shop-Subject` header the shop-api
 * believes, so a cookie claiming `manager` would reach that service as a staff
 * claim this app never issued. Screening the claim against what `/session`
 * issues keeps the demo's unsigned identity from being an escalation path into
 * the authoritative layer.
 */
// #region storefront-roles
const STOREFRONT_ROLES: readonly string[] = ['customer'];
// #endregion storefront-roles

/**
 * A browser that has not signed in.
 *
 * It states no role, so the shop-api's `order.create` rule -- which requires
 * `customer` -- refuses it, both here and again at the service. A shopper signs
 * in at `/session` to get {@link CUSTOMER_SUBJECT}.
 */
export const ANONYMOUS_SUBJECT: StorefrontSubject = {
  id: 'anonymous',
  roles: [],
  shop: '',
};

/** The one identity `/session` issues: a signed-in shopper. */
export const CUSTOMER_SUBJECT: StorefrontSubject = {
  id: 'customer:demo',
  roles: ['customer'],
  shop: '',
};

/**
 * The subject a cookie payload states, or {@link ANONYMOUS_SUBJECT}.
 *
 * A payload missing a member, stating one at the wrong type, or claiming a role
 * outside {@link STOREFRONT_ROLES} is discarded whole. Repairing half of it
 * would hand the matrix a subject whose `shop` nobody stated.
 */
export function parseSubject(value: unknown): StorefrontSubject {
  if (typeof value !== 'object' || value === null) return ANONYMOUS_SUBJECT;

  const { id, roles, shop } = value as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return ANONYMOUS_SUBJECT;
  if (typeof shop !== 'string') return ANONYMOUS_SUBJECT;
  if (!Array.isArray(roles)) return ANONYMOUS_SUBJECT;
  if (!roles.every((role) => STOREFRONT_ROLES.includes(role as string))) {
    return ANONYMOUS_SUBJECT;
  }

  return { id, roles: [...(roles as string[])], shop };
}

/**
 * The subject the request's cookies state.
 *
 * Typed structurally against what it needs rather than against Astro's
 * `AstroCookies`, the idiom `readCart` follows, which keeps this module testable
 * without an Astro request. `json()` throws on a cookie hand-edited into invalid
 * JSON, and an unreadable identity is an anonymous one rather than a 500.
 */
export function readSubject(cookies: {
  get(name: string): { json(): unknown } | undefined;
}): StorefrontSubject {
  try {
    return parseSubject(cookies.get(SUBJECT_COOKIE)?.json());
  } catch {
    return ANONYMOUS_SUBJECT;
  }
}
