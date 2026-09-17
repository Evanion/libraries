import { policy, type Decision } from '@evanion/acl';

/**
 * The policy behind the Authorization demonstration, and the three people it is
 * asked about.
 *
 * One short policy decides every control on the interface beside it. That is the
 * claim the section makes, so the policy is built here by the package's own
 * typed builder and queried by `access.can`; the interface reads the answers and
 * renders. `access.test.tsx` drives the demonstration and holds it to that.
 *
 * Shared by the server, which renders the opening interface, and the client
 * island, which renders every state after it.
 */

/** What a person is to this policy. */
export type Role = 'customer' | 'bookseller' | 'owner';

/** Every role, in the order the switch offers them. */
export const roles: readonly Role[] = ['customer', 'bookseller', 'owner'];

/** Who is signed in. `name` is for the interface; `role` is what decides. */
interface Shopper {
  name: string;
  role: Role;
}

/** A listing. A status and nothing else, because that is all a rule reads. */
interface Listing {
  status: 'draft' | 'published';
}

/** The one object kind the demonstration decides about. */
type ShopObjects = { listing: Listing };

/** What a listing answers for. Three of them sit outside the four verbs. */
type ShopVerbs = { listing: 'review' | 'edit' | 'publish' };

/**
 * The three people the switch moves between, by the role that names them.
 *
 * Keyed by role rather than listed, so the switch reads a person out of it with
 * no lookup that can miss. `Mika Persson` listed the game, which is why the
 * byline says so whoever is signed in.
 */
export const people: Record<Role, Shopper> = {
  customer: { name: 'Sam Reyes', role: 'customer' },
  bookseller: { name: 'Mika Persson', role: 'bookseller' },
  owner: { name: 'Jo Vainio', role: 'owner' },
};

/** The roles each action is granted to. The editable half of the policy. */
export interface Grants {
  edit: readonly Role[];
  publish: readonly Role[];
}

/** What the policy opens on. */
export const openingGrants: Grants = {
  edit: ['bookseller', 'owner'],
  publish: ['owner'],
};

/**
 * The policy, on the typed authoring path.
 *
 * `policy<Shopper, ShopObjects, ShopVerbs>()` names the subject, the object
 * types and the verbs each kind answers for once, so every path in a condition
 * and every action a block declares is checked
 * against those two types as it is written: `subject.roles` here does not
 * compile, and the compiler's message names the path rather than reporting an
 * assignability mismatch twelve lines away.
 *
 * Rebuilt whenever the reader changes a grant. Building is a fold over a handful
 * of conditions into a frozen document, so rebuilding it on a click costs
 * nothing worth caching.
 */
export function buildAccess(grants: Grants) {
  return policy<Shopper, ShopObjects, ShopVerbs>()
    .for('listing', (p) =>
      p
        .allow('review', p.always)
        .allow('edit', p.in('subject.role', grants.edit))
        .allow('publish', p.in('subject.role', grants.publish))
        .deny('edit', p.eq('object.status', 'published')),
    )
    .build();
}

/** The built policy, as the demonstration holds it. */
export type Access = ReturnType<typeof buildAccess>;

/** One control on the interface, and the action it is granted by. */
export interface Control {
  action: ShopVerbs['listing'];
  /** What the control says, which depends on what pressing it would do. */
  label: (listing: Listing) => string;
}

/** The interface's controls, in the order they sit on the bar. */
export const controls: readonly Control[] = [
  { action: 'review', label: () => 'Review' },
  { action: 'edit', label: () => 'Edit' },
  {
    action: 'publish',
    label: (listing) => (listing.status === 'draft' ? 'Publish' : 'Unpublish'),
  },
];

/** What the policy says about each control, for this person and this listing. */
export function decisionsOf(
  access: Access,
  person: Shopper,
  listing: Listing,
): Record<string, Decision> {
  return Object.fromEntries(
    controls.map((control) => [
      control.action,
      access.can(person, 'listing', control.action, listing),
    ]),
  );
}

/** A run of the policy's text, or the grant a reader can change inside it. */
export type Segment = { text: string } | { grant: keyof Grants };

/** One line of the policy as the panel sets it. */
export interface SourceLine {
  segments: readonly Segment[];
  /** The rule this line declares, when it declares one. */
  rule?: { action: string; side: 'allow' | 'deny' };
}

/**
 * `buildAccess` as text, with the two grants left open where the builder reads
 * them.
 *
 * A grant segment renders the roles as controls rather than as a literal, so the
 * reader changes the policy by pressing on it and the demonstration can never be
 * driven into a document the package would refuse. The line a decision came from
 * is lit as the reader moves between people, which is the cheapest way to say
 * this short a policy did all of that.
 */
export const source: readonly SourceLine[] = [
  {
    segments: [
      {
        text: "const access = policy<Shopper, ShopObjects, ShopVerbs>()\n  .for('listing', (p) =>",
      },
    ],
  },
  { segments: [{ text: '    p' }] },
  {
    segments: [{ text: "      .allow('review', p.always)" }],
    rule: { action: 'review', side: 'allow' },
  },
  {
    segments: [
      { text: "      .allow('edit',\n        p.in('subject.role', " },
      { grant: 'edit' },
      { text: '))' },
    ],
    rule: { action: 'edit', side: 'allow' },
  },
  {
    segments: [
      { text: "      .allow('publish',\n        p.in('subject.role', " },
      { grant: 'publish' },
      { text: '))' },
    ],
    rule: { action: 'publish', side: 'allow' },
  },
  {
    segments: [
      { text: "      .deny('edit', p.eq('object.status', 'published'))," },
    ],
    rule: { action: 'edit', side: 'deny' },
  },
  { segments: [{ text: '  )\n  .build();' }] },
];

/** Whether a line's rule is the one that decided its action. */
export function isLit(
  line: SourceLine,
  decisions: Record<string, Decision>,
): boolean {
  if (!line.rule) return false;
  const reason = decisions[line.rule.action]?.reason;
  return line.rule.side === 'allow' ? reason === 'allow' : reason === 'denied';
}
