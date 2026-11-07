import type {
  ContextSchema,
  FeatureConfig,
  SerializedCondition,
} from './config.js';
import { isRelative } from './instant.js';

/** What a document needs of the library that evaluates it. */
export interface Requirements {
  /** The lowest `@evanion/feature` version that evaluates the document as written. */
  version: string;
  /** The constructs that set `version`, deduplicated and sorted. */
  uses: readonly ('exists' | 'instant-field' | 'path' | 'relative-instant')[];
}

/** A construct that only a library at or above 0.2.0 reads as the document means. */
type Use = Requirements['uses'][number];

type Op = SerializedCondition['op'];

/**
 * What each condition op needs beyond its field name. A new op makes this
 * mapped type fail to compile until it is listed.
 */
const OP_USES: {
  readonly [O in Op]: (
    condition: Extract<SerializedCondition, { op: O }>,
  ) => readonly Use[];
} = {
  eq: () => [],
  ne: () => [],
  in: () => [],
  'not-in': () => [],
  contains: () => [],
  'day-of-week': () => [],
  exists: () => ['exists'],
  'not-exists': () => ['exists'],
  before: windowUses,
  after: windowUses,
};

/**
 * 0.1 compares a `before` or `after` condition with `now` whatever its field
 * says, and refuses a `{ fromNow }` value.
 */
function windowUses(
  condition: Extract<SerializedCondition, { op: 'before' | 'after' }>,
): readonly Use[] {
  const uses: Use[] = [];
  if (condition.field !== 'now') uses.push('instant-field');
  if (isRelative(condition.value)) uses.push('relative-instant');
  return uses;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The elements of a value that is an array, and nothing otherwise. */
function elements(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
}

/**
 * Whether 0.1 and 0.2 read a field name differently: it holds a `.`, which 0.1
 * reads as part of a flat key, or a `\`, which 0.1 reads as a character.
 */
function readsAsPath(name: string): boolean {
  return name.includes('.') || name.includes('\\');
}

/** Whether a name holds a `.` that is not the second half of a `\` escape. */
function hasUnescapedDot(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '\\') i++;
    else if (name[i] === '.') return true;
  }
  return false;
}

/**
 * Calls `visit` for every place a document names a context field, with the JSON
 * pointer of the place: a condition's `field`, a rollout's `by`, a feature's
 * `variantBy`, and a schema key.
 */
function visitFields(
  config: unknown,
  visit: (
    name: string,
    pointer: string,
    condition?: Record<string, unknown>,
  ) => void,
): void {
  if (!isRecord(config)) return;
  const schema = config['schema'];
  const context = isRecord(schema) ? schema['context'] : undefined;
  if (isRecord(context))
    visitSchemaKeys(context['fields'], '/schema/context/fields', visit);

  for (const [f, feature] of elements(config['features']).entries()) {
    if (!isRecord(feature)) continue;
    const at = `/features/${f}`;
    const variantBy = feature['variantBy'];
    if (typeof variantBy === 'string') visit(variantBy, `${at}/variantBy`);

    for (const [r, rule] of elements(feature['rules']).entries()) {
      if (!isRecord(rule)) continue;
      const ruleAt = `${at}/rules/${r}`;
      for (const [c, condition] of elements(rule['when']).entries()) {
        if (!isRecord(condition)) continue;
        const field = condition['field'];
        if (typeof field === 'string') {
          visit(field, `${ruleAt}/when/${c}/field`, condition);
        }
      }
      const rollout = rule['rollout'];
      const by = isRecord(rollout) ? rollout['by'] : undefined;
      if (typeof by === 'string') visit(by, `${ruleAt}/rollout/by`);
    }
  }
}

function visitSchemaKeys(
  fields: unknown,
  base: string,
  visit: (name: string, pointer: string) => void,
): void {
  if (!isRecord(fields)) return;
  for (const name of Object.keys(fields)) {
    visit(name, `${base}/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`);
  }
}

/**
 * The lowest `@evanion/feature` version that evaluates a document as written,
 * and the constructs that set it. A publisher compares `version` with the SDK
 * versions it sees and warns or blocks.
 *
 * The version is `0.2.0` when a field name, rollout `by` or `variantBy` holds a
 * `.` or `\` (0.1 reads it as one flat key, so an old client silently decides
 * on an absent field), when a condition is `exists` or `not-exists` (0.1
 * refuses the operator), when a `before` or `after` condition reads a field
 * other than `now` (0.1 compares `now` instead), or when its value is
 * `{ fromNow }` (0.1 refuses it). Otherwise it is `0.1.0`.
 *
 * Schema keys set nothing: 0.1 reads the schema only to validate, and a
 * condition that names a dotted key already sets `path`.
 *
 * `correlateBy` is a store option and not part of a document, so this function
 * does not see it. A store that sets `correlateBy` to a dotted name needs 0.2.0
 * whatever the document says.
 *
 * @example
 * requirements({ features: [{ key: 'f', enabled: true, rules: [{ when: [{ field: 'plan', op: 'exists' }] }] }] });
 * // { version: '0.2.0', uses: ['exists'] }
 */
export function requirements(config: FeatureConfig): Requirements {
  const uses = new Set<Use>();
  visitFields(config, (name, pointer, condition) => {
    if (pointer.startsWith('/schema/')) return;
    if (readsAsPath(name)) uses.add('path');
    const op = condition?.['op'];
    if (typeof op !== 'string' || !Object.hasOwn(OP_USES, op)) return;
    const opUses = OP_USES[op as Op] as (c: unknown) => readonly Use[];
    for (const use of opUses(condition)) uses.add(use);
  });
  const sorted = [...uses].sort();
  return { version: sorted.length === 0 ? '0.1.0' : '0.2.0', uses: sorted };
}

/**
 * Every `field`, `by`, `variantBy` and schema key in a document or a context
 * schema that holds an unescaped `.`, with the JSON pointer of the place. 0.1
 * read such a name as one flat key and 0.2 reads it as a path, so a holder of
 * stored 0.1 documents runs this before upgrading and rewrites each name that
 * was a flat key with {@link escapeField}.
 *
 * `correlateBy` is a store option and not part of a document, so this function
 * does not see it. Check the option where the store is built.
 */
export function ambiguousFields(
  input: FeatureConfig | ContextSchema,
): readonly { pointer: string; name: string }[] {
  const found: { pointer: string; name: string }[] = [];
  const record: unknown = input;
  if (isRecord(record) && !('features' in record) && 'fields' in record) {
    visitSchemaKeys(record['fields'], '/fields', (name, pointer) => {
      if (hasUnescapedDot(name)) found.push({ pointer, name });
    });
    return found;
  }
  visitFields(record, (name, pointer) => {
    if (hasUnescapedDot(name)) found.push({ pointer, name });
  });
  return found;
}
