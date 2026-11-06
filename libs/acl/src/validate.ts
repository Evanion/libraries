import type { AclConfigError } from './errors.js';
import {
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  DuplicateRuleIdError,
  InvalidConditionError,
  InvalidFreshnessError,
  InvalidMatrixError,
  InvalidPermissionError,
  InvalidRuleError,
  KeyMismatchError,
  MissingFreshnessBudgetError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { settleNow, toEpoch } from './conditions.js';
import {
  formatPath,
  parsePath,
  pathFault as fieldPathFault,
} from './field-path.js';
import {
  collectInto,
  eachPermission,
  guarded,
  inPermission,
  show,
  throwFirst,
  unreadableDocument,
} from './issues.js';
import type { Report, Segment } from './issues.js';
import { assertSchemaFit, assertSchemaShape } from './schema.js';
import type {
  Condition,
  FieldConfig,
  Instant,
  Matrix,
  MatrixSchema,
  Permission,
} from './types.js';

/** The operators that compare a namespaced path against a literal or a path. */
const VALUE_OPS = new Set(['eq', 'ne', 'in', 'not-in', 'contains']);

/** The operators that compare the settled clock against a boundary instant. */
const TIME_OPS = new Set(['before', 'after']);

/** The scopes a condition path may name, besides the bare clock. */
const SCOPES = new Set(['subject', 'object']);

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Whether a condition operand is supplied. A key that is present and `undefined`
 * counts as absent: it is what a JSON round trip leaves behind, and what an
 * operand-less condition would compare against.
 */
function supplied(node: Node, key: string): boolean {
  return Object.hasOwn(node, key) && node[key] !== undefined;
}

/**
 * Why a path does not resolve, or undefined when it does.
 *
 * `readPath` splits a path on its first dot and reads the remainder as a single
 * own key, so exactly one dot after a known scope is the whole resolvable set. A
 * bare `now` reads the settled clock.
 */
function pathFault(path: unknown): string | undefined {
  if (typeof path !== 'string') return 'must be a string';
  if (path === 'now') return undefined;
  const dot = path.indexOf('.');
  if (dot === -1) {
    return 'must be "now" or a scoped path ("subject.<field>", "object.<field>")';
  }
  if (!SCOPES.has(path.slice(0, dot))) {
    return 'names no known scope: must be "subject.*", "object.*" or "now"';
  }
  const field = path.slice(dot + 1);
  if (field.length === 0) return 'names no field after its scope';
  if (field.includes('.')) {
    return 'nests below its scope: a path reads one field of a scope, so at most one dot is resolvable';
  }
  return undefined;
}

/**
 * `value` as an epoch, or NaN when reading it throws. An object with a Date
 * prototype and no Date slot passes `instanceof Date` and then throws in
 * `getTime`, and a document can hold other values whose conversion throws.
 */
function epochOf(value: Instant): number {
  try {
    return toEpoch(value);
  } catch {
    return Number.NaN;
  }
}

/** `String(value)`, or a fixed description when converting throws. */
function stringOf(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unreadable]';
  }
}

/**
 * Validates one condition's shape, namespaces and operator/value pairing, and
 * answers whether it is evaluable.
 *
 * Each check reads what the one before it settled (the op decides which
 * operands apply, the field decides which path form), so the first fault is the
 * only one reported per condition.
 *
 * An operand the engine would ignore is refused rather than dropped: a `path` on
 * an operator that compares against a literal, or a `value` alongside a `path`,
 * is config whose author expects it to decide something.
 */
function assertCondition(
  report: Report,
  at: readonly Segment[],
  key: string,
  where: string,
  condition: Condition,
): boolean {
  if (!isNode(condition)) {
    report(
      new InvalidConditionError(key, where, where, 'is not an object'),
      at,
    );
    return false;
  }
  const node = condition as Node;
  const field = node['field'];
  const named = typeof field === 'string' ? field : where;

  if (!isNonEmptyString(field)) {
    report(
      new InvalidConditionError(
        key,
        where,
        named,
        'has no field: a condition names the path it reads',
      ),
      at,
    );
    return false;
  }

  const op = node['op'];
  if (typeof op !== 'string' || (!VALUE_OPS.has(op) && !TIME_OPS.has(op))) {
    report(
      new InvalidConditionError(
        key,
        where,
        named,
        `has an unknown op ${show(op)}`,
      ),
      at,
    );
    return false;
  }

  if (field === 'now' || TIME_OPS.has(op)) {
    if (field !== 'now' || !TIME_OPS.has(op)) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          'pairs a clock with a comparison: "now" supports before/after, and before/after read "now"',
        ),
        at,
      );
      return false;
    }
    if (supplied(node, 'path')) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          'carries a path: a time condition compares the clock against a literal instant',
        ),
        at,
      );
      return false;
    }
    const value = node['value'];
    const instant =
      typeof value === 'string' ||
      typeof value === 'number' ||
      value instanceof Date;
    if (!instant) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          'needs an instant value: an ISO string, epoch milliseconds, or a Date',
        ),
        at,
      );
      return false;
    }
    // The boundary comes from the document and is settled once, here. A window
    // whose edge is not a point in time states nothing a decision could read,
    // and the document is the party that can fix it.
    if (Number.isNaN(epochOf(value))) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          `carries an instant that does not parse: ${show(stringOf(value))}`,
        ),
        at,
      );
      return false;
    }
    return true;
  }

  const fieldFault = pathFault(field);
  if (fieldFault) {
    report(new InvalidConditionError(key, where, named, fieldFault), at);
    return false;
  }

  const hasPath = supplied(node, 'path');
  const hasValue = supplied(node, 'value');

  if (op === 'eq' || op === 'ne') {
    if (hasPath === hasValue) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          hasPath
            ? 'carries both a path and a value: an equality compares against exactly one comparand'
            : 'carries no comparand: an equality needs a path or a value',
        ),
        at,
      );
      return false;
    }
    if (hasPath) {
      const fault = pathFault(node['path']);
      if (fault) {
        report(
          new InvalidConditionError(
            key,
            where,
            named,
            `has a path ${show(node['path'])} that ${fault}`,
          ),
          at,
        );
        return false;
      }
    }
    return true;
  }

  if (hasPath) {
    report(
      new InvalidConditionError(
        key,
        where,
        named,
        `carries a path: only eq and ne compare against a path, ${op} compares against a value`,
      ),
      at,
    );
    return false;
  }

  if (op === 'in' || op === 'not-in') {
    if (!Array.isArray(node['value'])) {
      report(
        new InvalidConditionError(
          key,
          where,
          named,
          `needs an array value: ${op} tests membership of a list`,
        ),
        at,
      );
      return false;
    }
    return true;
  }

  if (!hasValue) {
    report(
      new InvalidConditionError(
        key,
        where,
        named,
        'needs a value: contains tests the field for one element',
      ),
      at,
    );
    return false;
  }
  return true;
}

/**
 * Validates one rule's shape. Reports a condition that is not evaluable and
 * adds each one that is to `usable`.
 *
 * `when` must be present. An empty `when` is the unconditional form, so a rule
 * that arrives without the key is indistinguishable from one an author wrote as
 * `always` — and the two cases differ by an unconditional grant. Requiring the
 * key separates them, and costs nothing across a JSON boundary, where `[]`
 * survives and `undefined` does not.
 *
 * A rule that is not an object has no `id` or `when` to read. A bad `id` does
 * not stop the `when` check; a `when` that is not an array has no conditions.
 */
function assertRule(
  report: Report,
  at: readonly Segment[],
  key: string,
  where: string,
  rule: unknown,
  usable: WeakSet<object>,
): void {
  if (!isNode(rule)) {
    report(new InvalidRuleError(key, where, 'is not an object'), at);
    return;
  }
  const id = rule['id'];
  if (id !== undefined && typeof id !== 'string') {
    report(new InvalidRuleError(key, where, 'has an id that is not a string'), [
      ...at,
      'id',
    ]);
  }
  const when = rule['when'];
  if (!Array.isArray(when)) {
    report(
      new InvalidRuleError(
        key,
        where,
        Object.hasOwn(rule, 'when') && when !== undefined
          ? 'has a when that is not an array'
          : 'has no when: an unconditional rule states it as an empty when array',
      ),
      at,
    );
    return;
  }
  for (const [index, condition] of when.entries()) {
    const accepted = assertCondition(
      report,
      [...at, 'when', index],
      key,
      `${where}.when[${index}]`,
      condition as Condition,
    );
    if (accepted) usable.add(condition as object);
  }
}

/**
 * Validates one rule array's shape.
 *
 * `side` names the array inside the document, so a fault is located where the
 * author wrote it. `validateMatrix` passes `rules` and `denyRules`; a deny
 * overlay passes `overlay`, which is the same gate over a contribution that is
 * not yet part of a permission. A value that is not an array has no rules to
 * check.
 */
function collectRules(
  report: Report,
  base: readonly Segment[],
  key: string,
  side: string,
  rules: unknown,
  usable: WeakSet<object>,
): void {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    report(new InvalidPermissionError(key, side, 'is not an array'), base);
    return;
  }
  for (const [index, rule] of rules.entries()) {
    assertRule(
      report,
      [...base, index],
      key,
      `${side}[${index}]`,
      rule,
      usable,
    );
  }
}

/** Validates one rule array's shape and throws the first fault. */
export function assertRules(key: string, side: string, rules: unknown): void {
  throwFirst((report) => {
    collectRules(report, [side], key, side, rules, new WeakSet());
  });
}

/**
 * Reports each rule of one permission that repeats an `id` already taken.
 *
 * The check runs over both sides at once, so an allow rule and a deny rule of
 * one permission may not share an id either. `ruleId` derives an id from the
 * conditions and the side, as `allow-53eebf50`, so two sides never collide by
 * derivation; a `Decision` carries `rule` as one string with no side beside it,
 * and an explicit id on both sides leaves that string naming two rules that
 * decide opposite ways.
 *
 * A rule that states no `id` is skipped. Two such rules with identical
 * conditions derive one id and decide identically, which `ruleId` documents and
 * this does not reopen. A side that is not an array, a rule that is not an
 * object and an `id` that is not a string have no id to compare.
 */
function collectDuplicateRuleIds(
  report: Report,
  base: readonly Segment[],
  key: string,
  permission: Node,
): void {
  const taken = new Set<string>();
  for (const side of ['rules', 'denyRules']) {
    const rules = permission[side];
    if (!Array.isArray(rules)) continue;
    for (const [index, rule] of rules.entries()) {
      if (!isNode(rule)) continue;
      const id = rule['id'];
      if (typeof id !== 'string') continue;
      if (taken.has(id)) {
        report(new DuplicateRuleIdError(key, id), [...base, side, index, 'id']);
        continue;
      }
      taken.add(id);
    }
  }
}

/** Every member the canonical permission node carries. */
const PERMISSION_MEMBERS = new Set([
  'key',
  'object',
  'action',
  'rules',
  'denyRules',
  'fields',
  'visibility',
]);

/** The two markings a permission may carry. Absent is `internal`. */
const VISIBILITIES = new Set(['public', 'internal']);

/**
 * Reports each member the canonical permission node does not have, and a
 * `visibility` that is neither marking.
 *
 * A member nothing reads is a rule the author wrote and the engine never
 * applies, and `dependsOn` is the instance that matters: a document written for
 * the cascade states a deny this engine has no step for, so accepting it
 * silently would grant what its author refused.
 */
function collectMembers(
  report: Report,
  base: readonly Segment[],
  key: string,
  permission: Node,
): void {
  for (const member of Object.keys(permission)) {
    if (PERMISSION_MEMBERS.has(member)) continue;
    report(
      new InvalidPermissionError(
        key,
        member,
        'is not a member of a permission',
      ),
      [...base, member],
    );
  }

  // A misspelled marking is what an author reaches for when they meant to
  // publish, and every spelling except `public` would otherwise read as
  // internal and publish nothing without saying so.
  const visibility = permission['visibility'];
  if (visibility !== undefined && !VISIBILITIES.has(visibility as string)) {
    report(
      new InvalidPermissionError(
        key,
        'visibility',
        'is neither "public" nor "internal"',
      ),
      [...base, 'visibility'],
    );
  }
}

/**
 * Reports a field config's faults and answers whether it is usable.
 *
 * A config that is not an object has no members to check. Both `targets` and
 * `transitions` is reported first and the two members are still checked, as
 * each one's shape is independent of the other.
 */
function assertFieldConfig(
  report: Report,
  at: readonly Segment[],
  key: string,
  field: string,
  config: unknown,
): boolean {
  if (!isNode(config)) {
    report(
      new InvalidPermissionError(
        key,
        `fields.${field}`,
        'is not a field config',
      ),
      at,
    );
    return false;
  }
  let usable = true;
  if ('targets' in config && 'transitions' in config) {
    report(new TargetsTransitionsConflictError(field), at);
    usable = false;
  }
  const { targets, transitions } = config as Partial<FieldConfig> & Node;
  if (targets !== undefined && !Array.isArray(targets)) {
    report(
      new InvalidPermissionError(
        key,
        `fields.${field}.targets`,
        'is not an array',
      ),
      [...at, 'targets'],
    );
    usable = false;
  }
  if (transitions !== undefined) {
    if (!isNode(transitions)) {
      report(
        new InvalidPermissionError(
          key,
          `fields.${field}.transitions`,
          'is not an object',
        ),
        [...at, 'transitions'],
      );
      return false;
    }
    for (const [from, to] of Object.entries(transitions)) {
      if (!Array.isArray(to)) {
        report(
          new InvalidPermissionError(
            key,
            `fields.${field}.transitions.${from}`,
            'is not an array',
          ),
          [...at, 'transitions', from],
        );
        usable = false;
      }
    }
  }
  return usable;
}

/** The most segments a field-rule path may have; the walk recurses per segment. */
const MAX_PATH_SEGMENTS = 32;

/**
 * The segments of a field-rule path, or `undefined` after reporting why it
 * cannot be one. `name` is a list entry without its leading `!`, or a config
 * key.
 */
function segmentsOf(
  report: Report,
  at: readonly Segment[],
  key: string,
  where: string,
  name: string,
): readonly string[] | undefined {
  const fault = fieldPathFault(name);
  if (fault !== undefined) {
    report(new InvalidPermissionError(key, where, fault), at);
    return undefined;
  }
  const segments = parsePath(name) as readonly string[];
  if (segments.length > MAX_PATH_SEGMENTS) {
    report(
      new InvalidPermissionError(
        key,
        where,
        `${JSON.stringify(name)} has ${segments.length} segments; a path may have at most ${MAX_PATH_SEGMENTS}.`,
      ),
      at,
    );
    return undefined;
  }
  return segments;
}

/** Entries by their path, so an ancestor is found by looking up each prefix. */
function indexOf(entries: readonly PathEntry[]): Map<string, PathEntry> {
  return new Map(entries.map((entry) => [formatPath(entry.segments), entry]));
}

/**
 * The entry whose path is `path` (unless `proper`) or names a key above it, or
 * `undefined` when none does.
 */
function ancestorIn(
  index: ReadonlyMap<string, PathEntry>,
  path: readonly string[],
  proper: boolean,
): PathEntry | undefined {
  for (
    let length = proper ? path.length - 1 : path.length;
    length > 0;
    length--
  ) {
    const found = index.get(formatPath(path.slice(0, length)));
    if (found) return found;
  }
  return undefined;
}

interface PathEntry {
  readonly segments: readonly string[];
  readonly where: string;
  readonly text: string;
  readonly at: readonly Segment[];
}

function contradiction(
  key: string,
  first: PathEntry,
  second: PathEntry,
  why: string,
): InvalidPermissionError {
  return new InvalidPermissionError(
    key,
    second.where,
    `${JSON.stringify(second.text)} contradicts ${JSON.stringify(first.text)} at "${first.where}": ${why}`,
  );
}

/**
 * Reports the faults of a permission's field rules.
 *
 * `fields` not being an object has no entries. The allow-list and the per-field
 * configs are independent of each other, and an entry or config whose path is
 * not one is left out of the cross-checks, which compare paths. The
 * cross-checks run over the entries that remain, in this order: an allow under
 * an exclusion, a `!` entry with no baseline, a config under an exclusion, any
 * entry under a config.
 */
function collectFieldRules(
  report: Report,
  base: readonly Segment[],
  key: string,
  rules: unknown,
): void {
  if (rules === undefined) return;
  if (!isNode(rules)) {
    report(new InvalidPermissionError(key, 'fields', 'is not an object'), base);
    return;
  }

  let star = false;
  const allows: PathEntry[] = [];
  const denies: PathEntry[] = [];
  const configs: PathEntry[] = [];

  const names = rules['fields'];
  if (names !== undefined) {
    // `fields` is the allow-list key, so it is the one name a field cannot
    // have: a field called `fields` has nowhere to put its `targets` or
    // `transitions`. Naming that here, rather than only the type mismatch,
    // is the whole statement of the limit a foreign producer gets.
    if (!Array.isArray(names)) {
      report(
        new InvalidPermissionError(
          key,
          'fields.fields',
          'is not an array: "fields" is the name allow-list, so no field may be called "fields"',
        ),
        [...base, 'fields'],
      );
    } else {
      for (const [index, name] of names.entries()) {
        const where = `fields.fields[${index}]`;
        const at = [...base, 'fields', index];
        if (!isNonEmptyString(name)) {
          report(
            new InvalidPermissionError(key, where, 'is not a field name'),
            at,
          );
          continue;
        }
        if (name === '*') {
          star = true;
          continue;
        }
        const denied = name.startsWith('!');
        const segments = segmentsOf(
          report,
          at,
          key,
          where,
          denied ? name.slice(1) : name,
        );
        if (segments === undefined) continue;
        (denied ? denies : allows).push({ segments, where, text: name, at });
      }
    }
  }

  for (const [field, config] of Object.entries(rules)) {
    if (field === 'fields') continue;
    if (config === undefined) continue;
    const where = `fields.${field}`;
    const at = [...base, field];
    const segments = segmentsOf(report, at, key, where, field);
    const usable = assertFieldConfig(report, at, key, field, config);
    if (segments === undefined || !usable) continue;
    configs.push({ segments, where, text: field, at });
  }

  const denied = indexOf(denies);
  const allowed = indexOf(allows);
  const configured = indexOf(configs);

  for (const allow of allows) {
    const deny = ancestorIn(denied, allow.segments, false);
    if (!deny) continue;
    report(
      contradiction(
        key,
        deny,
        allow,
        deny.segments.length === allow.segments.length
          ? 'an entry and its own exclusion state two intents for one path'
          : 'an allow below an excluded path states two intents for one path',
      ),
      allow.at,
    );
  }

  if (!star) {
    for (const deny of denies) {
      if (ancestorIn(allowed, deny.segments, true)) continue;
      report(new DenyWithoutBaselineError(key, deny.text), deny.at);
    }
  }

  for (const config of configs) {
    const deny = ancestorIn(denied, config.segments, true);
    if (!deny) continue;
    report(
      contradiction(
        key,
        deny,
        config,
        'a rule below an excluded path states two intents for one path',
      ),
      config.at,
    );
  }

  for (const other of [...allows, ...denies, ...configs]) {
    const config = ancestorIn(configured, other.segments, true);
    if (!config) continue;
    report(
      contradiction(
        key,
        config,
        other,
        'a targets or transitions rule decides its whole subtree, so no other rule may sit below it',
      ),
      other.at,
    );
  }
}

const ENVELOPE =
  'a matrix is an envelope: { version?, maxStale?, schema?, permissions }';

/**
 * Checks one permission, reporting every fault.
 *
 * A permission that is not an object, or has no key, has nothing to name its
 * faults by and nothing else is checked. A bad `object` or `action` stops only
 * the checks that read them (the delimiter and key-match checks); the member,
 * rule, rule-id and field-rule checks read none of the three. The duplicate-key
 * check reads the key alone.
 */
function collectPermission(
  report: Report,
  index: number,
  permission: unknown,
  keys: Set<string>,
  usable: WeakSet<object>,
): void {
  const base: readonly Segment[] = ['permissions', index];
  if (!isNode(permission)) {
    report(
      new InvalidMatrixError(`permission [${index}] is not an object`),
      base,
    );
    return;
  }
  const { key, object, action } = permission as Partial<Permission> & Node;
  if (!isNonEmptyString(key)) {
    report(new InvalidMatrixError(`permission [${index}] has no key`), [
      ...base,
      'key',
    ]);
    return;
  }
  const here = inPermission(report, key);
  const objectOk = isNonEmptyString(object);
  const actionOk = isNonEmptyString(action);
  if (!objectOk) {
    here(new InvalidPermissionError(key, 'object', 'is not an object kind'), [
      ...base,
      'object',
    ]);
  }
  if (!actionOk) {
    here(new InvalidPermissionError(key, 'action', 'is not an action'), [
      ...base,
      'action',
    ]);
  }
  // A key is built by joining the two parts on a dot, and that join is
  // reversible only while neither part carries one: `{ object: 'a.b',
  // action: 'c' }` and `{ object: 'a', action: 'b.c' }` are two permissions
  // with one key. An object kind namespaced by origin is spelled with a
  // colon -- `orders:invoice.read` -- which stays legal.
  if (objectOk && object.includes('.')) {
    here(
      new InvalidPermissionError(
        key,
        'object',
        'carries the key delimiter ".": an object kind namespaced by origin is spelled "origin:kind"',
      ),
      [...base, 'object'],
    );
  }
  if (actionOk && action.includes('.')) {
    here(
      new InvalidPermissionError(
        key,
        'action',
        'carries the key delimiter "."',
      ),
      [...base, 'action'],
    );
  }
  if (objectOk && actionOk && key !== `${object}.${action}`) {
    here(new KeyMismatchError(key, object, action), [...base, 'key']);
  }

  if (keys.has(key)) {
    here(new DuplicatePermissionError(key), [...base, 'key']);
  }
  keys.add(key);

  collectMembers(here, base, key, permission);
  collectRules(
    here,
    [...base, 'rules'],
    key,
    'rules',
    permission['rules'],
    usable,
  );
  collectRules(
    here,
    [...base, 'denyRules'],
    key,
    'denyRules',
    permission['denyRules'],
    usable,
  );
  collectDuplicateRuleIds(here, base, key, permission);
  collectFieldRules(here, [...base, 'fields'], key, permission['fields']);
}

/**
 * The freshness faults of a holder's `fetchedAt` and local `maxStale` against a
 * document's `maxStale`, in the order a holder is told of them.
 *
 * Supplying `fetchedAt` is a request for a freshness budget, so every check
 * here is conditional on it: a local `maxStale` alone claims nothing. The three
 * checks read independent inputs. They are not located in the document, which
 * holds neither option, so the two option faults sit at the root and the missing
 * budget at the `maxStale` the document should state.
 */
export function freshnessIssues(
  documentMaxStale: unknown,
  options: ValidateOptions,
): AclConfigError[] {
  return settleFreshness(documentMaxStale, options).issues;
}

/**
 * `freshnessIssues` with the result a clean check settles: `expiresAt`, the
 * instant past which the holder's validation no longer holds, or `undefined`
 * when `fetchedAt` is absent or any issue was reported.
 */
export function settleFreshness(
  documentMaxStale: unknown,
  options: ValidateOptions,
): { issues: AclConfigError[]; expiresAt: number | undefined } {
  const issues: AclConfigError[] = [];
  const { fetchedAt, maxStale: local } = options;
  if (fetchedAt === undefined) return { issues, expiresAt: undefined };
  const report = collectInto(issues);

  const validated = settleNow(fetchedAt);
  if (Number.isNaN(validated)) {
    report(new InvalidFreshnessError('fetchedAt', 'is not an instant'), []);
  }
  if (local !== undefined && (!Number.isFinite(local) || local < 0)) {
    report(
      new InvalidFreshnessError(
        'maxStale',
        'is not a finite, non-negative number of milliseconds',
      ),
      [],
    );
  }
  if (documentMaxStale === undefined) {
    report(new MissingFreshnessBudgetError(), ['maxStale']);
  }
  if (issues.length > 0 || typeof documentMaxStale !== 'number') {
    return { issues, expiresAt: undefined };
  }
  return {
    issues,
    expiresAt: validated + Math.min(documentMaxStale, local ?? Infinity),
  };
}

/**
 * What a holder knows about the document that the document does not: when it
 * last validated, and how long it will trust that.
 */
export interface ValidateOptions {
  /** The instant the holder last validated the document against its origin. */
  fetchedAt?: Instant;
  /** A shorter local ceiling on staleness, in milliseconds. */
  maxStale?: number;
}

/**
 * Collects every fault of a canonical matrix document, in document order: the
 * envelope, then its permissions' shape, rules and field configs, then its
 * conditions against a present schema, then the freshness of `options`.
 *
 * Keys are unique. Lookup is a map, so a second permission under a key already
 * taken decides every call the first was written to answer, and the winner is
 * whichever the array put last.
 *
 * Rule ids are unique within a permission, across both of its sides.
 * `DuplicateRuleIdError` states why.
 *
 * This is the whole gate between a foreign matrix and the engine: every entry
 * point passes through it, and everything it accepts evaluates without throwing.
 * Every issue is an `AclConfigError` naming the permission key and the
 * offending field.
 *
 * A fault stops only the checks that read the faulty node. A document that is
 * not an object, or whose `permissions` is not an array, stops everything. A
 * `version` or `maxStale` fault stops nothing. A malformed `schema` stops the
 * schema pass, which reads declared types, and nothing else. The schema pass
 * runs last and skips a condition that is not evaluable, so that condition is
 * reported as that rather than as a schema fault. Freshness faults are reported
 * only for a document that has reached the permissions.
 */
export function collectIssues(
  matrix: unknown,
  options: ValidateOptions = {},
): AclConfigError[] {
  const issues: AclConfigError[] = [];
  const report = collectInto(issues);
  guarded(report, [], unreadableDocument, () => {
    collectDocument(report, matrix, issues, options);
  });
  return issues;
}

function collectDocument(
  report: Report,
  matrix: unknown,
  issues: AclConfigError[],
  options: ValidateOptions,
): void {
  if (!isNode(matrix)) {
    report(new InvalidMatrixError(ENVELOPE), []);
    return;
  }

  const permissions = matrix['permissions'];
  if (!Array.isArray(permissions)) {
    report(
      new InvalidMatrixError(`"permissions" is not an array: ${ENVELOPE}`),
      ['permissions'],
    );
    return;
  }

  const version = matrix['version'];
  if (
    version !== undefined &&
    typeof version !== 'string' &&
    typeof version !== 'number'
  ) {
    report(
      new InvalidMatrixError('"version" is neither a string nor a number'),
      ['version'],
    );
  }

  // A bound the comparison cannot use answers "fresh" on every call, so the
  // refusal is here and not at the first decision that reads it.
  const maxStale = matrix['maxStale'];
  if (
    maxStale !== undefined &&
    (typeof maxStale !== 'number' || !Number.isFinite(maxStale) || maxStale < 0)
  ) {
    report(
      new InvalidMatrixError(
        '"maxStale" is not a finite, non-negative number of milliseconds',
      ),
      ['maxStale'],
    );
  }

  const schema = matrix['schema'];
  const schemaOk = schema === undefined || assertSchemaShape(schema, report);

  const keys = new Set<string>();
  const usable = new WeakSet<object>();
  eachPermission(report, permissions, (index, permission) => {
    collectPermission(report, index, permission, keys, usable);
  });

  if (schema !== undefined && schemaOk) {
    assertSchemaFit(schema as MatrixSchema, permissions, report, (condition) =>
      typeof condition === 'object' && condition !== null
        ? usable.has(condition)
        : false,
    );
  }

  issues.push(...freshnessIssues(maxStale, options));
}

/**
 * Validates a canonical matrix document and throws the first fault
 * `collectIssues` reports, as the error class and message it has always had.
 */
export function validateMatrix(matrix: Matrix): void {
  const [first] = collectIssues(matrix);
  if (first) throw first;
}
