import {
  ActionNotAllowedError,
  pickAllowedFields,
  policy,
  type FieldDecision,
} from '@evanion/acl';

/**
 * The policy behind the field-write demonstration, and the people and rows it
 * is asked about.
 *
 * The page it mounts on teaches two calls: `canFields` decides the action and
 * every field of a write, and `pickAllowedFields` turns that decision into the
 * object the ORM receives. Both are real calls here. The component renders what
 * the package returned and computes nothing of its own, and
 * `field-write.test.tsx` holds every pane against the same calls.
 */

/** Who is signed in. `roles` is what the bookseller rule reads. */
export interface Asker {
  id: string;
  name: string;
  roles: readonly string[];
}

/** The question row, as the database holds it. */
export interface Question {
  askedBy: string;
  body: string;
  status: string;
  [key: string]: unknown;
}

/** The kinds this policy answers for. */
type QuestionObjects = { question: Question };

/** Who the switch moves between, in the order it offers them. */
export const askers: readonly Asker[] = [
  { id: 'c1', name: 'Sam Reyes', roles: [] },
  { id: 'c2', name: 'Jo Vainio', roles: [] },
  { id: 'u1', name: 'Mika Persson', roles: ['bookseller'] },
];

/** The row every question on this page is about. Sam asked it. */
export const ASKED_BY = 'c1';

/** The two values `status` moves between. */
export const statuses = ['open', 'locked'] as const;

/** A status, as the controls offer it. */
export type Status = (typeof statuses)[number];

/**
 * The policy, on the typed authoring path the page's own fence uses.
 *
 * Two allow rules and one field block. Either rule grants `update`: the person
 * who asked the question, or a bookseller. Nobody else matches anything, which
 * is how the demonstration reaches a refused action while the field maps are
 * still filled in.
 *
 * `fields` is the object form, so the name allow-list and the per-field config
 * sit in one place. The list names `body` and nothing else, which leaves
 * `askedBy` and any key the form invents -- `pinned` is the one on the screen --
 * decided `not-listed`. `status` is claimed by the `transitions` config, so the
 * name list never sees it and the state machine decides it from the value the
 * row holds now.
 */
export function buildAccess() {
  return policy<Asker, QuestionObjects>()
    .for('question', (p) =>
      p
        .allow('update', p.eq('object.askedBy', 'subject.id'))
        .allow('update', p.contains('subject.roles', 'bookseller'))
        .fields({
          fields: ['body'],
          status: { transitions: { open: ['locked'], locked: [] } },
        }),
    )
    .build();
}

/** The built policy, built once because nothing the reader touches changes it. */
export const access = buildAccess();

/** Everything the four controls hold between them. */
export interface Proposal {
  /** Who is signed in, by id. */
  who: string;
  /** The body the form posts. */
  body: string;
  /** The status the form posts. */
  status: Status;
  /** Whether the form posts `pinned`, a key no rule names. */
  pinned: boolean;
  /** What the row holds now, which is what `transitions` reads. */
  current: Status;
  /** Whether the query that fetched the row selected `status`. */
  selectedStatus: boolean;
}

/** What the demonstration opens on: Sam's own question, an open row. */
export const opening: Proposal = {
  who: 'c1',
  body: 'Wingspan in stock?',
  status: 'locked',
  pinned: false,
  current: 'open',
  selectedStatus: true,
};

/** The row as the query returned it, which is the object `canFields` reads. */
export function rowOf(proposal: Proposal): Record<string, unknown> {
  const row: Record<string, unknown> = {
    askedBy: ASKED_BY,
    body: 'In stock?',
  };
  if (proposal.selectedStatus) row['status'] = proposal.current;
  return row;
}

/** The write the form posts, which is the object `canFields` decides over. */
export function proposedOf(proposal: Proposal): Record<string, unknown> {
  const proposed: Record<string, unknown> = {
    body: proposal.body,
    status: proposal.status,
  };
  if (proposal.pinned) proposed['pinned'] = true;
  return proposed;
}

/** The person the switch is standing on. */
export function askerOf(proposal: Proposal): Asker {
  return askers.find((asker) => asker.id === proposal.who) ?? askers[0]!;
}

/** The decision, from the package, for whatever the controls currently say. */
export function decide(proposal: Proposal): FieldDecision {
  return access.canFields(
    askerOf(proposal),
    'question',
    'update',
    rowOf(proposal),
    'write',
    proposedOf(proposal),
  );
}

/** What the third pane shows: the picked object, or the error instead of it. */
export type Picked =
  | { kind: 'object'; value: Record<string, unknown> }
  | { kind: 'error'; name: string; message: string };

/**
 * `pickAllowedFields` run for real, with the throw caught rather than described.
 *
 * A refused action is the case the call exists to make loud, so the pane has to
 * be able to show the error. Catching it here keeps the component free of a
 * `try` around its own render.
 */
export function pick(proposal: Proposal): Picked {
  try {
    return {
      kind: 'object',
      value: pickAllowedFields(
        decide(proposal),
        proposedOf(proposal),
      ) as Record<string, unknown>,
    };
  } catch (error) {
    if (error instanceof ActionNotAllowedError) {
      return {
        kind: 'error',
        name: 'ActionNotAllowedError',
        message: error.message,
      };
    }
    throw error;
  }
}

/** The field rows, in a stable order, whatever order the maps were built in. */
export function fieldRows(
  decision: FieldDecision,
): { field: string; state: string; reason: string }[] {
  return Object.keys(decision.fields)
    .sort()
    .map((field) => ({
      field,
      state: decision.fields[field] as string,
      reason: decision.reasons[field] as string,
    }));
}
