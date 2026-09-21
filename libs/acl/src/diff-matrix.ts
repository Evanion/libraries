import { canonical } from './canonical.js';
import { conditionReadsObject } from './conditions.js';
import { permissionReadsObject } from './reads-object.js';
import { ruleId } from './rule-id.js';
import type { Condition, Matrix, Permission, Rule } from './types.js';

/**
 * A branch's conditions split by what a reviewer reads them as.
 *
 * `subject` describes who gained or lost the access, `object` which rows, and
 * `window` when. A condition comparing a subject path against an object path
 * lands in `object`, because it restricts which rows rather than which people.
 */
export interface ConditionGroups {
  readonly subject: readonly Condition[];
  readonly object: readonly Condition[];
  readonly window: readonly Condition[];
}

/** Why a permission's access widened. */
export type GrantedCause =
  | 'permission-added'
  | 'allow-branch-added'
  | 'deny-branch-removed'
  | 'field-list-widened';

/** Why a permission's access narrowed. */
export type WithdrawnCause =
  | 'permission-removed'
  | 'allow-branch-removed'
  | 'deny-branch-added'
  | 'field-list-narrowed';

/** Why a change could not be classified as a widening or a narrowing. */
export type UndeterminedCause =
  'rule-edited' | 'both-sides-changed' | 'fields-changed';

/**
 * Access this document grants that the previous one did not.
 *
 * `when` is the added branch whole, and `groups` is it split for rendering. The
 * branch is an over-approximation in the widening direction: some of what it
 * describes may already have been granted by another branch, and the diff does
 * not subtract, because the exactly-new set means negating a disjunctive normal
 * form and the result is unreadable even when it is small.
 */
export interface GrantedFinding {
  readonly kind: 'granted';
  readonly key: string;
  readonly cause: GrantedCause;
  readonly rule?: string;
  readonly when: readonly Condition[];
  readonly groups: ConditionGroups;
  /** The field names added, when `cause` is `field-list-widened`. */
  readonly fields?: readonly string[];
}

/**
 * Access the previous document granted that this one does not.
 *
 * `holders` carries the two sentences a removed permission needs, because a
 * `parseMatrix` holder and a `hydratePolicy` holder meet one edit as two
 * different events.
 */
export interface WithdrawnFinding {
  readonly kind: 'withdrawn';
  readonly key: string;
  readonly cause: WithdrawnCause;
  readonly rule?: string;
  readonly when: readonly Condition[];
  readonly groups: ConditionGroups;
  readonly holders?: { readonly closed: string; readonly open: string };
  /** The field names removed, when `cause` is `field-list-narrowed`. */
  readonly fields?: readonly string[];
}

/**
 * A change the diff refuses to classify, with both versions shown.
 *
 * A report that quietly called an edited condition unchanged would be worse
 * than no report, because a reviewer would stop reading it. So an edit in place
 * is reported and classified as neither.
 */
export interface UndeterminedFinding {
  readonly kind: 'undetermined';
  readonly key: string;
  readonly cause: UndeterminedCause;
  readonly rule?: string;
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * A change in which `object.*` paths a decision reads.
 *
 * The edit behind this usually appears in the granted or the withdrawn list as
 * well, and reading only that list gets the blast radius wrong. Adding a deny
 * rule over `object.locked` is reported as a narrowing, which a reviewer reads
 * as "locked rows lose the access". Every caller that decides without loading
 * the row is affected too, whatever the row holds: the permission answered
 * `allow` and now answers `unevaluable` naming the path it needs.
 *
 * A gateway deciding before it reads the row goes from passing the request to
 * refusing it, and a UI holds a decision it must refetch to settle.
 */
export interface ReadsObjectFinding {
  readonly kind: 'reads-object';
  readonly key: string;
  readonly before: boolean;
  readonly after: boolean;
  readonly paths: {
    readonly before: readonly string[];
    readonly after: readonly string[];
  };
}

export type DiffFinding =
  GrantedFinding | WithdrawnFinding | UndeterminedFinding | ReadsObjectFinding;

/** What `diffMatrix` answers. */
export interface MatrixDiff {
  readonly findings: readonly DiffFinding[];
  /** True when the two documents state one policy. */
  readonly unchanged: boolean;
  readonly version: {
    readonly before?: string | number;
    readonly after?: string | number;
  };
}

function groupsOf(when: readonly Condition[]): ConditionGroups {
  const subject: Condition[] = [];
  const object: Condition[] = [];
  const window: Condition[] = [];
  for (const condition of when) {
    if (condition.field === 'now') window.push(condition);
    else if (conditionReadsObject(condition)) object.push(condition);
    else subject.push(condition);
  }
  return { subject, object, window };
}

/** Every `object.*` path a permission's own conditions read, sorted. */
function objectPaths(permission: Permission): readonly string[] {
  const paths = new Set<string>();
  const sides = [permission.rules, permission.denyRules];
  for (const rules of sides) {
    for (const rule of rules ?? []) {
      for (const condition of rule.when ?? []) {
        if (condition.field.startsWith('object.')) paths.add(condition.field);
        const comparand = 'path' in condition ? condition.path : undefined;
        if (comparand?.startsWith('object.')) paths.add(comparand);
      }
    }
  }
  return [...paths].sort();
}

/**
 * One side indexed by rule id. The id is derived from the rule's conditions, so
 * a rule keeps its key across a reorder and an insertion, and a set difference
 * over these keys is the whole of the branch classification.
 *
 * An author-supplied `id` is the author's statement of identity, so a rule that
 * keeps its id and changes its conditions reads as an edit rather than as a
 * removal and an addition. That is the one case the diff cannot classify.
 */
function indexSide(
  rules: readonly Rule[] | undefined,
  side: 'allow' | 'deny',
): Map<string, Rule> {
  return new Map((rules ?? []).map((rule) => [ruleId(rule, side), rule]));
}

interface SideChange {
  readonly added: readonly [string, Rule][];
  readonly removed: readonly [string, Rule][];
  readonly edited: readonly [string, Rule, Rule][];
}

function compareSide(
  before: readonly Rule[] | undefined,
  after: readonly Rule[] | undefined,
  side: 'allow' | 'deny',
): SideChange {
  const from = indexSide(before, side);
  const to = indexSide(after, side);
  const added: [string, Rule][] = [];
  const removed: [string, Rule][] = [];
  const edited: [string, Rule, Rule][] = [];

  for (const [id, rule] of to) {
    const was = from.get(id);
    if (was === undefined) added.push([id, rule]);
    else if (canonical(was.when ?? []) !== canonical(rule.when ?? [])) {
      edited.push([id, was, rule]);
    }
  }
  for (const [id, rule] of from) {
    if (!to.has(id)) removed.push([id, rule]);
  }
  return { added, removed, edited };
}

function changed(side: SideChange): boolean {
  return (
    side.added.length > 0 || side.removed.length > 0 || side.edited.length > 0
  );
}

/** A name list carrying no `*` baseline and no `!` subtraction, or undefined. */
function literalNames(permission: Permission): readonly string[] | undefined {
  const names = permission.fields?.fields;
  if (!Array.isArray(names)) return undefined;
  const literal = names.every(
    (name) => typeof name === 'string' && name !== '*' && !name.startsWith('!'),
  );
  return literal ? (names as readonly string[]) : undefined;
}

function granted(
  key: string,
  cause: GrantedCause,
  rule: string | undefined,
  when: readonly Condition[],
  fields?: readonly string[],
): GrantedFinding {
  return {
    kind: 'granted',
    key,
    cause,
    rule,
    when,
    groups: groupsOf(when),
    fields,
  };
}

function withdrawn(
  key: string,
  cause: WithdrawnCause,
  rule: string | undefined,
  when: readonly Condition[],
  holders?: { readonly closed: string; readonly open: string },
  fields?: readonly string[],
): WithdrawnFinding {
  return {
    kind: 'withdrawn',
    key,
    cause,
    rule,
    when,
    groups: groupsOf(when),
    holders,
    fields,
  };
}

/**
 * Field rules, which are mostly undecidable and say so.
 *
 * A name allow-list has no defined comparison between configurations: `['*',
 * '!price']` and `['title']` over one field set have no intersection
 * expressible in the syntax, and the object's field list is absent from the
 * matrix. The one decidable case is two literal name lists, where subset and
 * superset are set comparison.
 */
function diffFields(
  key: string,
  before: Permission,
  after: Permission,
): readonly DiffFinding[] {
  const was = before.fields;
  const now = after.fields;
  if (canonical(was) === canonical(now)) return [];

  const from = literalNames(before);
  const to = literalNames(after);
  if (from !== undefined && to !== undefined) {
    const gone = from.filter((name) => !to.includes(name));
    const arrived = to.filter((name) => !from.includes(name));
    const findings: DiffFinding[] = [];
    if (arrived.length > 0) {
      findings.push(granted(key, 'field-list-widened', undefined, [], arrived));
    }
    if (gone.length > 0) {
      findings.push(
        withdrawn(key, 'field-list-narrowed', undefined, [], undefined, gone),
      );
    }
    if (findings.length > 0) return findings;
  }

  return [
    {
      kind: 'undetermined',
      key,
      cause: 'fields-changed',
      before: was,
      after: now,
    },
  ];
}

function diffPermission(before: Permission, after: Permission): DiffFinding[] {
  const key = after.key;
  const findings: DiffFinding[] = [];

  const allow = compareSide(before.rules, after.rules, 'allow');
  const deny = compareSide(before.denyRules, after.denyRules, 'deny');

  for (const [id, was, now] of [...allow.edited, ...deny.edited]) {
    findings.push({
      kind: 'undetermined',
      key,
      cause: 'rule-edited',
      rule: id,
      before: was.when ?? [],
      after: now.when ?? [],
    });
  }

  if (changed(allow) && changed(deny)) {
    // Both sides moved. Each side alone is monotone, and their composition is
    // not, so the net direction is not derivable from the rule sets.
    findings.push({
      kind: 'undetermined',
      key,
      cause: 'both-sides-changed',
      before: { rules: before.rules, denyRules: before.denyRules },
      after: { rules: after.rules, denyRules: after.denyRules },
    });
  } else {
    // Appending an allow rule cannot remove an allow, and appending a deny rule
    // cannot add one, because `sideOutcome` is monotone in its rule array.
    for (const [id, rule] of allow.added) {
      findings.push(granted(key, 'allow-branch-added', id, rule.when ?? []));
    }
    for (const [id, rule] of deny.removed) {
      findings.push(granted(key, 'deny-branch-removed', id, rule.when ?? []));
    }
    for (const [id, rule] of allow.removed) {
      findings.push(
        withdrawn(key, 'allow-branch-removed', id, rule.when ?? []),
      );
    }
    for (const [id, rule] of deny.added) {
      findings.push(withdrawn(key, 'deny-branch-added', id, rule.when ?? []));
    }
  }

  findings.push(...diffFields(key, before, after));

  const readsBefore = permissionReadsObject(before);
  const readsAfter = permissionReadsObject(after);
  const pathsBefore = objectPaths(before);
  const pathsAfter = objectPaths(after);
  if (
    readsBefore !== readsAfter ||
    canonical(pathsBefore) !== canonical(pathsAfter)
  ) {
    findings.push({
      kind: 'reads-object',
      key,
      before: readsBefore,
      after: readsAfter,
      paths: { before: pathsBefore, after: pathsAfter },
    });
  }

  return findings;
}

/**
 * What changed between two matrix documents, reported as access rather than as
 * text.
 *
 * A line-by-line document diff answers the wrong question. A reviewer wants a
 * sentence of the form "this deploy lets any subject whose `roles` contains
 * `operator` reprice a listing", and an added allow branch is that sentence:
 * the branch's conditions are what an author wrote, so the report renders them
 * and infers nothing.
 *
 * Soundness rests on `sideOutcome` being monotone in its rule array. A side
 * that matched goes on matching whatever is appended, so an added allow branch
 * can only widen and an added deny branch can only narrow. `applyDenyOverlay`
 * derives its subtract-only property from the same argument and `serialize`
 * derives the contract's equality property from it.
 *
 * Four things the report cannot derive, each of which it states rather than
 * guesses at:
 *
 * - How many people a grant describes. The report names a condition and never a
 *   headcount, so findings cannot be ranked by blast radius and the reviewer
 *   supplies that judgement.
 * - Whether a grant overlaps one already in force. The report names the added
 *   branch whole, so a reviewer may read a grant that was already granted.
 * - Whether an added branch grants anything at all. A branch ANDing
 *   `subject.role eq 'admin'` with `subject.role eq 'operator'` is
 *   unsatisfiable and is reported as a grant.
 * - What an edit did. A rule that kept its id and changed its conditions, and a
 *   permission whose two sides both moved, are `undetermined` with both
 *   versions attached.
 *
 * Every one of those fails toward reporting a grant, which is the direction a
 * reviewer can check.
 */
export function diffMatrix(before: Matrix, after: Matrix): MatrixDiff {
  const from = new Map(before.permissions.map((each) => [each.key, each]));
  const to = new Map(after.permissions.map((each) => [each.key, each]));
  const findings: DiffFinding[] = [];

  const kindsAfter = new Set(after.permissions.map((each) => each.object));

  for (const [key, permission] of to) {
    const was = from.get(key);
    if (was === undefined) {
      for (const rule of permission.rules ?? []) {
        findings.push(
          granted(
            key,
            'permission-added',
            ruleId(rule, 'allow'),
            rule.when ?? [],
          ),
        );
      }
      if ((permission.rules ?? []).length === 0) {
        findings.push(granted(key, 'permission-added', undefined, []));
      }
      continue;
    }
    findings.push(...diffPermission(was, permission));
  }

  for (const [key, permission] of from) {
    if (to.has(key)) continue;
    // A removed permission is a refusal for a closed-mode holder and a thrown
    // error for an open-mode one, once the last permission of its kind goes.
    const open = kindsAfter.has(permission.object)
      ? `\`hydratePolicy\` holders: \`can\` throws \`UnknownPermissionError\` for \`${key}\`.`
      : `\`hydratePolicy\` holders: \`can\` throws \`UnknownObjectKeyError\`, because \`${permission.object}\` is no longer configured in this matrix.`;
    const holders = {
      closed: `\`parseMatrix\` holders: \`${key}\` answers \`unknown-action\` and refuses.`,
      open,
    };
    for (const rule of permission.rules ?? []) {
      findings.push(
        withdrawn(
          key,
          'permission-removed',
          ruleId(rule, 'allow'),
          rule.when ?? [],
          holders,
        ),
      );
    }
    if ((permission.rules ?? []).length === 0) {
      findings.push(
        withdrawn(key, 'permission-removed', undefined, [], holders),
      );
    }
  }

  return {
    findings,
    unchanged: findings.length === 0,
    version: { before: before.version, after: after.version },
  };
}
