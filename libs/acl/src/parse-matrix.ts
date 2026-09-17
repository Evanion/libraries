import {
  hydratePolicy,
  type Access,
  type AccessOptions,
  type AnyObjects,
  type Subject,
} from './hydrate-policy.js';
import type { Matrix } from './types.js';

/**
 * Adopts a matrix document from foreign or emitted JSON.
 *
 * The foreign path is untrusted configuration, so the resulting access object
 * fails closed on unknown permissions (never throws).
 *
 * How far field names are checked depends on the document. Without a `schema`,
 * shape and namespace are all that are validated, and a mistyped `object.*`
 * field decides `unevaluable` forever — the engine has nothing to check the name
 * against. With a `schema`, every condition over a declared kind is checked for
 * a name the kind declares and for an operator that fits the declared type. A
 * kind the schema does not declare stays unchecked.
 *
 * `Sub`, `R` and `Keys` are the same three parameters `hydratePolicy` takes, at
 * the same defaults, so an untyped adoption reads as it always has and a caller
 * that knows the document names them here:
 * `parseMatrix<ShopSubject, ShopObjects, 'listing.update'>(document)`.
 *
 * `Keys` is what the consumer expects to find, stated the way `Sub` and `R` are
 * already stated. It buys the consumer the same autocomplete the author gets:
 * `capabilities()` comes back keyed by that union, `'listing.updte'` is a
 * compile error, and the action of every query is checked against the keys its
 * object kind carries.
 *
 * The document is still foreign JSON and nothing checks it against any of the
 * three. A key the union names and the document omits decides
 * `unknown-action` at runtime, the same refusal it decided before the union
 * was written, and a key the document carries and the union omits is
 * unreachable from this handle rather than unreachable from the engine.
 * Producer and consumer in one build keep the union honest with `KeysOf`; two
 * repositories keep it honest the way they already keep `Sub` and `R` honest,
 * by reading the contract.
 */
export function parseMatrix<
  Sub = Subject,
  R = AnyObjects,
  Keys extends string = string,
>(matrix: Matrix, options: AccessOptions = {}): Access<Sub, R, Keys> {
  return hydratePolicy<Sub, R, Keys>(matrix, { ...options, closed: true });
}
