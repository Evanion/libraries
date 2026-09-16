import {
  createPolicy,
  type Access,
  type AccessOptions,
} from './create-policy.js';
import type { Matrix } from './types.js';

/**
 * Adopts a matrix document from foreign or emitted JSON.
 *
 * The foreign path is untrusted configuration, so the resulting access object
 * fails closed on unknown permissions (never throws).
 *
 * How far field names are checked depends on the document. Without a `schema`,
 * shape and namespace are all that are validated, and a mistyped `object.*`
 * field decides `undecidable` forever — the engine has nothing to check the name
 * against. With a `schema`, every condition over a declared kind is checked for
 * a name the kind declares and for an operator that fits the declared type. A
 * kind the schema does not declare stays unchecked.
 */
export function parseMatrix(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  return createPolicy(matrix, { ...options, closed: true });
}
