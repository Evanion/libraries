import { URN } from '@evanion/urn';

/**
 * Entity identity for a stubbed order, e.g. `urn:order:8f2c1a`.
 *
 * Fixes `nid` -- the URN namespace id that names the resource type -- to
 * `'order'`, for the same reason GameURN does: a subclass per entity type
 * keeps the nid a compile-time constant instead of a string threaded
 * through every call site, where it could be mistyped or swapped.
 */
export class OrderURN extends URN {
  static override readonly nid = 'order';
}
