import { policy, type Decision } from '@evanion/acl';

/**
 * The policy behind the repair-loop demonstration, and the question it is asked
 * about.
 *
 * It is the four-outcomes policy of `libs/acl/README.md`: one allow rule
 * reading `object.askedBy`, one deny rule reading `object.status`. Both paths
 * name the object, so a question fetched without them leaves the engine with
 * nothing to read and the decision comes back `unevaluable` naming what it
 * could not reach.
 *
 * The component renders `ask` and nothing else, and `unevaluable.test.tsx`
 * holds every outcome it can reach against the same call.
 */

/** The question's shape, as the rules name it. */
type Question = { askedBy: string; status: string };

/** Who is asking. The same subject throughout; only the question moves. */
export const subject = { id: 's1' };

/** A field of the question, and what a checkbox beside it says. */
export interface Selectable {
  /** The field name on the row. */
  field: 'askedBy' | 'status';
  /** The path the decision names when the field is absent. */
  path: string;
  /** What the checkbox is labelled. */
  label: string;
  /** The two values the row can hold, and what each one means here. */
  values: readonly { value: string; label: string }[];
}

/** The two fields the rules read, in the order the controls offer them. */
export const selectable: readonly Selectable[] = [
  {
    field: 'askedBy',
    path: 'object.askedBy',
    label: 'askedBy',
    values: [
      { value: 's1', label: 's1, yours' },
      { value: 's2', label: "s2, Jo's" },
    ],
  },
  {
    field: 'status',
    path: 'object.status',
    label: 'status',
    values: [
      { value: 'draft', label: 'draft' },
      { value: 'locked', label: 'locked' },
    ],
  },
];

/** The policy, built once: nothing the reader touches changes the document. */
export const access = policy<{ id: string }, { question: Question }>()
  .for('question', (p) =>
    p
      .allow('update', p.eq('object.askedBy', 'subject.id'))
      .deny('update', p.eq('object.status', 'locked')),
  )
  .build();

/** What the query returned: which fields it selected, and what they hold. */
export interface Query {
  /** The fields the query selected. A field left out never reaches the engine. */
  selected: readonly ('askedBy' | 'status')[];
  askedBy: string;
  status: string;
}

/** What the demonstration opens on: a projection that selected neither field. */
export const seed: Query = {
  selected: [],
  askedBy: 's1',
  status: 'draft',
};

/** The question object the query produced, which is what `can` is handed. */
export function questionOf(query: Query): Record<string, unknown> {
  const question: Record<string, unknown> = {};
  for (const { field } of selectable) {
    if (query.selected.includes(field)) question[field] = query[field];
  }
  return question;
}

/** The decision, from the package, for the question the query produced. */
export function ask(query: Query): Decision {
  return access.can(
    subject,
    'question',
    'update',
    questionOf(query) as Question,
  );
}

/**
 * The repair the decision asked for: select exactly the fields `missing` names.
 *
 * `missing` holds paths, and the query selects fields, so the paths are mapped
 * back through `selectable` rather than by trimming `object.` off a string. A
 * path the demonstration has no control for is dropped, which cannot happen
 * with these two rules and would be a silent no-op rather than a crash if it
 * did.
 */
export function refetch(query: Query): Query {
  const asked = ask(query).missing ?? [];
  const found = selectable
    .filter((entry) => asked.includes(entry.path))
    .map((entry) => entry.field);
  return {
    ...query,
    selected: [
      ...query.selected,
      ...found.filter((field) => !query.selected.includes(field)),
    ],
  };
}
