import {
  diffMatrix,
  policy,
  type Condition,
  type DiffFinding,
  type Matrix,
} from '@evanion/acl';

/** Who is asking. `roles` is what the rules read. */
interface Person {
  id: string;
  roles: string[];
}

interface Listing {
  id: string;
  sellerId: string;
  status: 'draft' | 'published';
}

type Verb = 'read' | 'edit' | 'reprice' | 'publish';

/** The rule changes the reader can try, one at a time. */
export type ChangeId =
  'sellers-reprice' | 'lock-published' | 'drop-publish' | 'reorder';

/** Which variant of the policy to build. */
interface Spec {
  version: string;
  sellersReprice?: boolean;
  lockPublished?: boolean;
  publish?: boolean;
  reorder?: boolean;
}

const BASE: Spec = { version: 'listings@7', publish: true };

/** Builds the matrix for one variant of the shop's policy. */
export function matrixOf(spec: Spec): Matrix {
  return policy<Person, { listing: Listing }, { listing: Verb }>({
    version: spec.version,
  })
    .for('listing', (p) => {
      const owner = (r: typeof p) =>
        r.allow('edit', r.contains('subject.roles', 'owner')).id('owner-edits');
      const seller = (r: typeof p) =>
        r
          .allow('edit', r.contains('subject.roles', 'bookseller'))
          .id('bookseller-edits');
      const start = p.allow('read', p.always).id('anyone-reads');
      let rules = spec.reorder ? owner(seller(start)) : seller(owner(start));
      rules = rules
        .allow('reprice', p.contains('subject.roles', 'owner'))
        .id('owner-reprices');
      if (spec.sellersReprice)
        rules = rules
          .allow(
            'reprice',
            p.contains('subject.roles', 'bookseller'),
            p.eq('object.sellerId', 'subject.id'),
          )
          .id('seller-reprices-own');
      if (spec.lockPublished)
        rules = rules
          .deny('edit', p.eq('object.status', 'published'))
          .id('published-is-locked');
      if (spec.publish)
        rules = rules
          .allow('publish', p.contains('subject.roles', 'owner'))
          .id('owner-publishes');
      return rules;
    })
    .build().matrix;
}

/** One change, as the toggle labels it, and the variant it produces. */
export const changes: readonly {
  id: ChangeId;
  label: string;
  after: Spec;
}[] = [
  {
    id: 'sellers-reprice',
    label: 'Let booksellers reprice listings they sell',
    after: { ...BASE, version: 'listings@8', sellersReprice: true },
  },
  {
    id: 'lock-published',
    label: 'Lock published listings against edits',
    after: { ...BASE, version: 'listings@8', lockPublished: true },
  },
  {
    id: 'drop-publish',
    label: 'Remove publishing',
    after: { ...BASE, version: 'listings@8', publish: false },
  },
  {
    id: 'reorder',
    label: 'Reorder the edit rules',
    after: { ...BASE, version: 'listings@8', reorder: true },
  },
];

/** One finding, worded for a reviewer. */
export interface ReportLine {
  kind: DiffFinding['kind'];
  text: string;
}

export interface Report {
  unchanged: boolean;
  versions: { before?: string | number; after?: string | number };
  lines: ReportLine[];
  /** The findings as the library returned them, trimmed to what the code panel shows. */
  raw: { kind: string; key: string; cause?: string }[];
}

const ROLES: Record<string, string> = {
  owner: 'Owners',
  bookseller: 'Booksellers',
  customer: 'Customers',
};

function verbOf(key: string): string {
  return key.split('.')[1] ?? key;
}

/** Who a set of subject conditions names. */
function who(conditions: readonly Condition[]): string {
  const roles = conditions.flatMap((c) =>
    c.field === 'subject.roles' && c.op === 'contains'
      ? [ROLES[String(c.value)] ?? String(c.value)]
      : [],
  );
  return roles.length > 0 ? roles.join(' and ') : 'Everyone';
}

/** Which rows a set of object conditions names. */
function rows(conditions: readonly Condition[]): string {
  const parts = conditions.map((c) => {
    if (c.field === 'object.sellerId' && c.path === 'subject.id')
      return 'that they sell';
    if (c.field === 'subject.id' && c.path === 'object.sellerId')
      return 'that they sell';
    if (c.field === 'object.status') return `that are ${String(c.value)}`;
    return 'matching the rule';
  });
  return parts.length > 0 ? `listings ${parts.join(' and ')}` : 'any listing';
}

function lostText(
  finding: Extract<DiffFinding, { kind: 'withdrawn' }>,
): string {
  const verb = verbOf(finding.key);
  const subject = finding.groups.subject;
  if (finding.cause === 'permission-removed')
    return `${who(subject)} can no longer ${verb}. The action is gone from the policy.`;
  const where = rows(finding.groups.object);
  return subject.length === 0
    ? `Nobody can ${verb} ${where} any more.`
    : `${who(subject)} can no longer ${verb} ${where}.`;
}

function lineOf(finding: DiffFinding): ReportLine[] {
  switch (finding.kind) {
    case 'granted':
      return [
        {
          kind: 'granted',
          text: `${who(finding.groups.subject)} can now ${verbOf(finding.key)} ${rows(finding.groups.object)}.`,
        },
      ];
    case 'withdrawn':
      return [{ kind: 'withdrawn', text: lostText(finding) }];
    case 'undetermined':
      return [
        {
          kind: 'undetermined',
          text: `A rule on ${verbOf(finding.key)} was edited. This one needs a human to read both versions.`,
        },
      ];
    case 'reads-object':
      return [
        {
          kind: 'reads-object',
          text: `A check on ${verbOf(finding.key)} now needs ${finding.paths.after.join(' and ')} loaded. Asked before the row is fetched, it answers cannot tell.`,
        },
      ];
  }
}

/** Runs the real `diffMatrix` for one change and words each finding. */
export function review(id: ChangeId): Report {
  const change = changes.find((c) => c.id === id);
  if (!change) throw new Error(`No change has the id ${id}`);
  const diff = diffMatrix(matrixOf(BASE), matrixOf(change.after));
  return {
    unchanged: diff.unchanged,
    versions: diff.version,
    lines: diff.findings.flatMap(lineOf),
    raw: diff.findings.map((f) => ({
      kind: f.kind,
      key: f.key,
      ...('cause' in f ? { cause: f.cause } : {}),
    })),
  };
}

export const beforeMatrix = (): Matrix => matrixOf(BASE);
