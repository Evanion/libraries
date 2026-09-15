import {
  createPolicy,
  type Access,
  type AccessOptions,
} from './create-policy.js';
import type { Matrix } from './types.js';

/**
 * Adopts a matrix from foreign or emitted JSON.
 *
 * The foreign path is untrusted configuration, so the resulting access object
 * fails closed on unknown permissions (never throws). Field-name validity is a
 * typed-path compile-time guarantee and is not checked here; only shape and
 * namespace are validated.
 */
export function parseMatrix(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  return createPolicy(matrix, { ...options, closed: true });
}
