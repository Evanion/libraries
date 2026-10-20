import { policy, type Decision } from '@evanion/acl';

/** Who is asking. `roles` is what the rules read. */
interface Person {
  id: string;
  roles: string[];
}

/** A listing, with the two fields the rules read. */
interface Listing {
  id: string;
  sellerId: string;
  status: 'draft' | 'published';
}

export type PersonId = 'customer' | 'seller' | 'owner';
export type ActionId = 'read' | 'edit' | 'publish';

/** The three people the reader chooses between. Mika listed the game. */
export const people: Record<PersonId, Person & { name: string }> = {
  customer: { id: 'sam', name: 'Sam', roles: ['customer'] },
  seller: { id: 'mika', name: 'Mika', roles: ['bookseller'] },
  owner: { id: 'jo', name: 'Jo', roles: ['owner'] },
};

/** The actions the reader chooses between, as the interface words them. */
export const actions: readonly { id: ActionId; label: string }[] = [
  { id: 'read', label: 'Read' },
  { id: 'edit', label: 'Edit' },
  { id: 'publish', label: 'Publish' },
];

/** The listing's seller, who is Mika. */
const SELLER = 'mika';

/** One policy, with every rule named so a decision can say which one spoke. */
export const access = policy<
  Person,
  { listing: Listing },
  { listing: ActionId }
>()
  .for('listing', (p) =>
    p
      .allow('read', p.always)
      .id('anyone-reads')
      .allow('edit', p.eq('object.sellerId', 'subject.id'))
      .id('seller-edits-own')
      .allow('edit', p.contains('subject.roles', 'owner'))
      .id('owner-edits-any')
      .deny('edit', p.eq('object.status', 'published'))
      .id('published-is-locked')
      .allow('publish', p.contains('subject.roles', 'owner'))
      .id('owner-publishes'),
  )
  .build();

/** What the reader has chosen. */
export interface Question {
  person: PersonId;
  action: ActionId;
  status: Listing['status'];
  /** False while only the listing's id is in hand, as after a list query. */
  rowLoaded: boolean;
}

/** The real decision, and the plain words for it. */
export interface Explained {
  decision: Decision;
  headline: 'Allowed' | 'Refused' | 'Cannot tell yet';
  detail: string;
  /** The paths to fetch before asking again; empty when nothing is missing. */
  fetch: readonly string[];
  /** Who wants to do what, as the sentence the verdict opens on. */
  sentence: string;
  /** True when the rule named could not be read without the row. */
  ruleNeedsRow: boolean;
}

const WHO: Record<PersonId, string> = {
  customer: 'A customer',
  seller: 'The bookseller who listed it',
  owner: 'The owner',
};

/** Asks the policy and words what it answered. */
export function explain(question: Question): Explained {
  const row = question.rowLoaded
    ? { id: 'brass-birmingham', sellerId: SELLER, status: question.status }
    : { id: 'brass-birmingham' };
  const decision = access.can(
    people[question.person],
    'listing',
    question.action,
    row as Listing,
  );
  const fetch = decision.missing ?? [];
  const sentence = `${WHO[question.person]} wants to ${question.action} this listing.`;

  if (decision.reason === 'unevaluable') {
    return {
      decision,
      headline: 'Cannot tell yet',
      detail: `${decision.rule ? `The rule ${decision.rule} needs the row. ` : ''}The listing in hand does not carry what the rules read. Fetch ${fetch.join(' and ')}, then ask again.`,
      fetch,
      sentence,
      ruleNeedsRow: decision.rule !== undefined,
    };
  }
  if (decision.allowed) {
    return {
      decision,
      headline: 'Allowed',
      detail: `The rule ${decision.rule} says yes.`,
      fetch,
      sentence,
      ruleNeedsRow: false,
    };
  }
  if (decision.reason === 'denied') {
    return {
      decision,
      headline: 'Refused',
      detail: `The rule ${decision.rule} says no, and a no beats any yes.`,
      fetch,
      sentence,
      ruleNeedsRow: false,
    };
  }
  return {
    decision,
    headline: 'Refused',
    detail: 'No rule says yes for this person, so the answer is no.',
    fetch,
    sentence,
    ruleNeedsRow: false,
  };
}
