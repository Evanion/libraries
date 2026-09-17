import type { Subject } from '@evanion/acl';

import { people, type Role } from './access';

/**
 * The values `PolicySpecimen` hands the provider, held still.
 *
 * `PolicyProvider` memoises on the identity of `access`, `subject` and
 * `context`, and every hook under it keys its own memo on the object it is
 * asked about. An object rebuilt during render is a new identity every pass, so
 * the specimen would re-evaluate the matrix on each render and demonstrate the
 * opposite of what the page says about the clock. These are module constants
 * for that reason.
 *
 * The policy, the people and the roles come from `./access`, which is the same
 * shop policy the Authorization section's demonstration is built on. One shop,
 * one policy: a reader arriving here from `/acl/interface` meets the listing
 * they have already read about, and a rule that changed there changes here.
 */

/**
 * One subject per role.
 *
 * `Subject` is `Record<string, unknown>`, and an interface is not assignable to
 * that -- TypeScript gives an implicit index signature to an object literal
 * type and not to a declared interface. Spreading each person once here is what
 * crosses that, rather than a cast at the provider.
 */
export const subjects = {
  customer: { ...people.customer },
  bookseller: { ...people.bookseller },
  owner: { ...people.owner },
} satisfies Record<Role, Subject>;

/** The listing the specimen is about, in each of the two states it has. */
export const listings = {
  draft: { id: 'brass-birmingham', status: 'draft' },
  published: { id: 'brass-birmingham', status: 'published' },
} satisfies Record<string, Record<string, unknown>>;

/** Which state of the listing the reader is looking at. */
export type Status = keyof typeof listings;

/**
 * The instant the specimen evaluates at, as a string.
 *
 * A string rather than `new Date()`: the hooks key their memos on `now`, and a
 * `Date` is a fresh object every render. Nothing in the shop policy reads the
 * clock, so the value is arbitrary and only its stability matters.
 */
export const now = '2026-09-17T09:00:00.000Z';

/** One control on the bar, and the action that decides whether it is drawn. */
export interface TreeControl {
  action: string;
  label: string;
  /** The component that asks, as the tree names it. */
  component: string;
}

/** The three controls, in the order they sit in the tree. */
export const treeControls: readonly TreeControl[] = [
  { action: 'review', label: 'Review', component: 'ReviewControl' },
  { action: 'edit', label: 'Edit', component: 'EditControl' },
  { action: 'publish', label: 'Publish', component: 'PublishControl' },
];

/** What the badge beside a control says about the decision behind it. */
export function badge(allowed: boolean, reason: string): string {
  return allowed ? 'allowed' : reason;
}
