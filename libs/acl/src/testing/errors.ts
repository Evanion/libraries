/**
 * Base class for every refusal this kit raises.
 *
 * A plain `Error` subclass and no matcher: the kit runs under vitest, node:test
 * and jest, and each of those reports a thrown error from a test body the same
 * way. Nothing here imports a test framework, so the package keeps the zero
 * runtime dependencies its security posture rests on.
 */
export class AclAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AclAssertionError';
  }
}
