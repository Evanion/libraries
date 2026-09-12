import type { Availability } from './ui/baize.js';
import type { ShelfPolicy } from './shelf.js';

/**
 * The availability a merchant has set per title, held in process memory.
 *
 * No persistence, matching the rest of the demo: shop-api's catalogue and stock
 * are in-memory too, so a restart returns every app to the same opening
 * position. A change made here survives until the server stops.
 *
 * `.server.ts` keeps the mutable state out of the browser bundle. Two tabs see
 * the same values because both read it through a loader on the server, which is
 * the behaviour a shared shelf has to have.
 */
const policy = new Map<string, Availability>([
  ['urn:game:brass-birmingham', 'reprint pending'],
  ['urn:game:gloomhaven', 'out of print'],
]);

/** A snapshot, so a caller cannot write through the returned object. */
export function readShelfPolicy(): ShelfPolicy {
  return Object.fromEntries(policy);
}

/** Declares an availability for one title, replacing any previous declaration. */
export function setShelfPolicy(urn: string, state: Availability): void {
  policy.set(urn, state);
}

/** Drops a declaration, returning the title to the state stock implies. */
export function clearShelfPolicy(urn: string): void {
  policy.delete(urn);
}
