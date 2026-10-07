import { configDigest } from './digest.js';
import { graphErrors } from './graph.js';
import { windowFault } from './conditions.js';
import { ruleId } from './rule-id.js';
import { variantErrors } from './variants.js';
import {
  DuplicateFeatureError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import type {
  ConfigIssue,
  ConfigIssueCode,
  FeatureConfig,
  FieldType,
  ValidationResult,
} from './config.js';
import type { GraphNode } from './graph.js';
import type { VariantCheckOptions } from './variants.js';
import type {
  AttributeCondition,
  Condition,
  DayOfWeekCondition,
  FeatureDefinition,
  FeatureKey,
  RolloutSpec,
  Rule,
  VariantSpec,
  WindowCondition,
} from './types.js';

/**
 * One issue, paired with the error the throwing path raises for it.
 *
 * `createFeatures` throws the error and `validateConfig` reports the issue, and
 * the message on both is one string, because one object produced it.
 */
export interface Found {
  issue: ConfigIssue;
  error: FeatureConfigError;
}

/**
 * What the checker reads: the definitions of a document, serialized or held.
 *
 * `validateConfig` hands it a `FeatureConfig`, whose `SerializedDefinition`
 * narrows a window instant and a condition value and widens nothing.
 * `createFeatures` hands it the definitions a TypeScript author wrote, where a
 * window carries a `Date`. The graph, the variants and the rule ids read `key`,
 * `dependsOn`, `variants`, `rule.id`, `rule.variant` and `rule.when`, which the
 * two forms declare alike, so the wider element type is what admits both
 * callers.
 *
 * The envelope members come from `FeatureConfig` unchanged, because the checks
 * over them read one document either way. `createFeatures` wraps the array an
 * author wrote as `{ features: config }`, which declares none of them, so the
 * digest, the schema version and the value shapes answer for a served document
 * and the member walk finds one member on a literal.
 */
export interface Checkable extends Omit<FeatureConfig, 'features'> {
  readonly features: readonly FeatureDefinition<FeatureKey>[];
}

/** The code a graph error reports as. */
function graphCode(error: FeatureConfigError): ConfigIssueCode {
  if (error instanceof DuplicateFeatureError) return 'duplicate-feature';
  if (error instanceof UnknownDependencyError) return 'unknown-dependency';
  if (error instanceof FeatureCycleError) return 'cycle';
  return 'duplicate-feature';
}

/**
 * The elements of an array a document carries, with each hole read as the
 * `undefined` element it is.
 *
 * `forEach` and `filter` skip a hole, so a walk over a sparse array reports
 * nothing about the element that is missing and returns one row fewer than the
 * array declares. `collectIssues` pairs each row with `config.features` at the
 * row's own index, so a dropped row sends every issue after it to the wrong
 * definition.
 *
 * `JSON.parse` writes no hole, and a caller reaches one by assigning past the
 * end of an array or deleting an element. `FeatureConfig` types a sparse array
 * as a whole one, so nothing stands between that caller and this checker. A
 * hole read this way reports the same issue an element written as `undefined`
 * reports, at the same pointer.
 *
 * `served` gates the three member walks that read it, for the reason the
 * amendment in
 * `docs/superpowers/plans/2026-09-29-feature-config-distribution.md` gives: the
 * refusals `createFeatures` throws are the ones a store would otherwise raise
 * out of `resolve`, and a hole in `features`, in `dependsOn` or in `variants`
 * raises where the literal author's own compiler reads a whole array. The
 * conditions of a rule are the exception. `evaluate.ts:53` iterates `rule.when`
 * and reads each element, so a hole there is a `when` element that is not an
 * object and both callers refuse it.
 */
function dense(value: readonly unknown[]): readonly unknown[] {
  return Array.from(value);
}

function found(
  code: ConfigIssueCode,
  error: FeatureConfigError,
  key?: FeatureKey,
  path?: string,
): Found {
  return {
    error,
    issue: {
      code,
      message: error.message,
      ...(key === undefined ? {} : { key }),
      ...(path === undefined ? {} : { path }),
    },
  };
}

/**
 * One reference token of a JSON pointer, escaped the way RFC 6901 reads it.
 *
 * § 7 declares `ConfigIssue.path` a JSON pointer, and RFC 6901 section 3 gives
 * `/` the meaning of the separator between two tokens and `~` the meaning of
 * the escape that carries it. A member name is the one part of a path this
 * checker does not choose: a control plane writes the document and
 * `strangeMembers` and the definition walk both build a token out of a name it
 * picked. A member named `sdk/hashVersion` written raw reads as two tokens, and
 * a UI resolving the pointer looks inside a member named `sdk`, finds nothing
 * and highlights no row.
 *
 * `~` is replaced first. Replacing `/` first would write `~1`, and the `~` pass
 * after it would write that as `~01`, which resolves to the literal text `~1`.
 */
function token(member: string): string {
  return member.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** The pointer at a definition, and optionally at one of its members. */
function pointer(at: number, member?: string): string {
  return member === undefined
    ? `/features/${String(at)}`
    : `/features/${String(at)}/${token(member)}`;
}

/** The word a message uses for each `typeof` a member may hold. */
const MET: Readonly<Record<string, string>> = {
  bigint: 'a bigint',
  boolean: 'a boolean',
  function: 'a function',
  number: 'a number',
  object: 'an object',
  string: 'a string',
  symbol: 'a symbol',
  undefined: 'nothing',
};

/** What a member carries, named the way the message reads it. */
function met(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'number' && !Number.isFinite(value))
    return String(value);
  return MET[typeof value] ?? typeof value;
}

/** Whether a value is an object the checker reads members off. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a value is a `FeatureKey`, at a definition's key or at a dependency. */
function isKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' || typeof value === 'number';
}

/** The key an issue names, for a definition whose key a document chose. */
function keyOf(
  definition: Readonly<Record<string, unknown>>,
): FeatureKey | undefined {
  const key: unknown = definition['key'];
  return isKey(key) ? key : undefined;
}

/** One unreadable member, as the issue and the error both paths carry. */
function unreadable(message: string, path: string, key?: FeatureKey): Found {
  return found('unknown-member', new FeatureConfigError(message), key, path);
}

/** What each member the checker walks holds, for the message that names it. */
const MEMBERS = {
  dependsOn: 'an array of keys',
  rules: 'an array of rules',
  variants: 'an array of variants',
} as const;

/** One element of a member the checker walks, for that same message. */
const ELEMENTS = { rules: 'rule', variants: 'variant' } as const;

/**
 * What the walks after the shape walk read off one definition.
 *
 * Each member stands on its own. § 7 has `validateConfig` report every issue it
 * finds, so a `variants` that arrived as an object stops this definition's
 * variant walk and stops nothing else, and the checker still reports the
 * duplicate key two other definitions declare. § 3's "refuses the whole
 * document, drops nothing and evaluates nothing" states what a holder installs,
 * and `validateConfig` installs nothing.
 *
 * Each flag refuses one walk over a member the checker could not read.
 * `"dependsOn": "ab"` is iterable, so a graph walk over it reads the two
 * characters as two dependencies and an operator reads a cycle that no row
 * declares.
 */
interface Readable {
  /** The key, when it arrived as a string or a number. */
  readonly key?: FeatureKey;
  /** The dependencies that arrived as keys, when `dependsOn` is an array. */
  readonly dependsOn?: readonly FeatureKey[];
  /** Whether `variants` is an array the variant walk reads. */
  readonly variants: boolean;
  /**
   * Whether the definition declares a `variants` member the checker could not
   * read. § 3 asks a definition declaring variants for a `variantBy` and a
   * `variantSeed` and reads both off the definition, so the two are asked for a
   * member this checker never walked as well.
   */
  readonly unreadVariants?: boolean;
  /** Whether `rules` is an array the rule walks read. */
  readonly rules: boolean;
  /**
   * The rules whose conditions the checker could not walk, by identity. Absent
   * where it walked every one. `ruleIdErrors` reads the id one of these
   * declares and derives none, because `ruleId` names a rule by what it matches
   * on and `conditionText` has no text for a condition this checker refused.
   */
  readonly unwalked?: ReadonlySet<unknown>;
  /**
   * The variants the checker read, where it could not read every element of the
   * array. Absent where it read them all, and where `variants` is not an array.
   */
  readonly someVariants?: readonly VariantSpec[];
  /**
   * The rules the checker read, where it could not read every element of the
   * array or the id one of them declares. Absent under the same two cases.
   */
  readonly someRules?: readonly Rule[];
  /**
   * The index each rule in `someRules` holds in the array the document
   * declares. Absent beside `someRules`, where the two agree. `whenIssues`
   * points at a condition by the rule that carries it, and the rules it walks
   * are the ones this walk read, so a document whose second rule is the first
   * one readable names the second.
   */
  readonly someRuleAt?: readonly number[];
}

/**
 * The members a definition declares, which `FeatureDefinition` in `types.ts`
 * names.
 *
 * A member outside this set is reported as `unknown-member`. § 3 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` has a bucketing
 * parameter this package adds later, a hash version among them, travel as a
 * required member with no default, so a holder too old to read it refuses the
 * document and the operator reads one refusal at the first poll. A holder that
 * walked past the member would bucket every subject on the algorithm it knows
 * while the publisher bucketed on the new one, and `configDigest` reports one
 * version on both sides.
 *
 * The walk reads a served document alone, and `arrayIsOrder` separates the two
 * callers here the way it separates them in `bucketingDefects`. § 3 states the
 * rule over a document a holder installs, and the plan's global constraints hold
 * `createFeatures` to throwing its six error classes from the inputs it throws on
 * today. An author whose definitions carry a member of their own declares them
 * through an interface extending `FeatureDefinition`, which assigns to
 * `readonly FeatureDefinition<K>[]` with no excess-property error, and that
 * member raises nothing out of `resolve`. `documentDefinition` in `serialize.ts`
 * copies the definition with `{ ...definition }`, so the member reaches the
 * document that store serves and `validateConfig` names it there.
 *
 * The literal is typed `Record<keyof FeatureDefinition, true>`, so the compiler
 * joins the set to the interface. A member added to `FeatureDefinition` and left
 * out here is a missing property the compiler names, and a member this literal
 * carries that the interface dropped is an excess one. A comment between the two
 * would hold neither: the release that added the member would serve a document
 * carrying it, every holder of that same release would refuse the document, and
 * § 3's refusal would fire against the publisher it is written to protect.
 */
const DEFINITION_MEMBERS: Record<keyof FeatureDefinition, true> = {
  key: true,
  enabled: true,
  dependsOn: true,
  rules: true,
  seed: true,
  freezeTimeAtBuild: true,
  variants: true,
  variantBy: true,
  variantSeed: true,
};

/** Those members, as the walk reads them. */
const DEFINED: ReadonlySet<string> = new Set(Object.keys(DEFINITION_MEMBERS));

/**
 * The two scalars of a definition that decide an answer and that no walk below
 * reads a type off.
 *
 * `key` and `enabled` are read for both callers above, and `dependsOn`,
 * `variants` and `rules` are read for the walks they feed. `variantBy` and
 * `variantSeed` reach `bucketingDefects`. These two reach the evaluation and
 * nothing else. `rolloutSeed` at `evaluate.ts:24-29` returns
 * `rule.rollout?.seed ?? definition.seed ?? String(definition.key)` and declares
 * `string`, and `encodePair` at `bucketing.ts:47` reads `seed.length`, so a
 * number writes the text `undefined:` where the string `"5"` writes `1:5` and
 * the holder ramps a population the publisher never chose. `planFeature` at
 * `evaluate.ts:302` reads `freezeTimeAtBuild` as a bare truthiness test, so a
 * served `"false"` resolves a time window at build time where the publisher's
 * `false` deferred it to the request.
 *
 * § 3 covers the seed by name: every member the assignment algorithm reads
 * travels whole or the document is refused. Both sit behind the `served` gate
 * for the reason the member walk does. Neither raises out of `resolve`, and the
 * compiler answers the author who writes a literal.
 */
const SCALARS: Readonly<
  Record<
    'seed' | 'freezeTimeAtBuild',
    { readonly type: string; readonly reads: string }
  >
> = {
  seed: {
    type: 'string',
    reads:
      'the string every rollout of this feature hashes its subjects against, so a holder installing this document would ramp a different population than the publisher',
  },
  freezeTimeAtBuild: {
    type: 'boolean',
    reads:
      'the boolean a plan reads the build-time clock by, so a holder installing this document would resolve a time window the publisher deferred',
  },
};

/**
 * Every key one member of a union declares. `keyof` over a union answers the
 * keys they share, so the distribution is what holds a set to the members of
 * two condition types and not to the ones they have in common.
 */
type MemberOf<T> = T extends unknown ? keyof T : never;

/**
 * The members of the shapes a definition holds below itself.
 *
 * § 3 states its rule over the whole document, and the member it names is a
 * bucketing parameter. `RolloutSpec` and `VariantSpec` are where such a
 * parameter lives -- `assignVariant` buckets on `variantSeedOf` and
 * `bucketOf`, and `rolloutText` at `rule-id.ts:68-72` reads `by` and `seed` --
 * so a walk that stopped at the definition would accept a hash version on a
 * rollout, derive the rule id it derived without it, and report one version on
 * both sides of `configDigest` while the publisher bucketed on an algorithm this
 * holder has no code for. That is GrowthBook's `hashVersion`, which sits on the
 * experiment rule.
 *
 * Each literal is typed against the interface it stands for, for the reason
 * `DEFINITION_MEMBERS` is. A condition has two sets, and `op` picks between
 * them: `DayOfWeekCondition` is the one type declaring `zone`, `conditionText`
 * writes that member for `op === 'day-of-week'` and for no other operator, and
 * `evaluateCondition` reads it in that one place. A `zone` beside an `eq` is a
 * member the holder evaluates as absent, which is what § 3 refuses.
 */
const RULE_MEMBERS: Record<keyof Rule, true> = {
  id: true,
  when: true,
  rollout: true,
  variant: true,
};

const ROLLOUT_MEMBERS: Record<keyof RolloutSpec, true> = {
  percent: true,
  by: true,
  seed: true,
};

const VARIANT_MEMBERS: Record<keyof VariantSpec, true> = {
  name: true,
  weight: true,
  order: true,
  value: true,
};

const CONDITION_MEMBERS: Record<
  MemberOf<WindowCondition | AttributeCondition>,
  true
> = {
  field: true,
  op: true,
  value: true,
};

const DAY_OF_WEEK_MEMBERS: Record<keyof DayOfWeekCondition, true> = {
  ...CONDITION_MEMBERS,
  zone: true,
};

/** Each of those sets, as the walk reads it. */
const RULE: ReadonlySet<string> = new Set(Object.keys(RULE_MEMBERS));
const ROLLOUT: ReadonlySet<string> = new Set(Object.keys(ROLLOUT_MEMBERS));
const VARIANT: ReadonlySet<string> = new Set(Object.keys(VARIANT_MEMBERS));
const CONDITION: ReadonlySet<string> = new Set(Object.keys(CONDITION_MEMBERS));
const DAY_OF_WEEK: ReadonlySet<string> = new Set(
  Object.keys(DAY_OF_WEEK_MEMBERS),
);

/**
 * Every operator a condition may declare, which `evaluateCondition` dispatches
 * on.
 *
 * `op` is the discriminator the member sets above are chosen by, and it decides
 * the answer as well. `evaluateCondition` switches on it and ends at
 * `default: return false` at `conditions.ts:101`, so a condition carrying an
 * operator this release has no branch for is evaluated as permanently false and
 * the rule resolves off for every subject. § 3's shape, member for member: the
 * producer emits what the consumer cannot read, the consumer fills the gap with
 * an answer-changing default, and `configDigest` reports one version on both
 * sides while the publisher that emitted the operator resolves the rule on.
 *
 * `conditionText`'s docblock at `rule-id.ts:36-43` names `'eq-ci'` as the
 * operator a later release adds, and length-prefixes `op` so that release does
 * not rename every `eq` rule. This is the other half of that: the release adding
 * the operator serves documents an older holder refuses.
 *
 * `Condition['op']` distributes over the union, so the literal answers for all
 * three condition types. An operator added to `types.ts` and left out here is a
 * missing property the compiler names.
 */
const CONDITION_OPS: Record<Condition['op'], true> = {
  before: true,
  after: true,
  'day-of-week': true,
  eq: true,
  ne: true,
  in: true,
  'not-in': true,
  contains: true,
};

const OPS: ReadonlySet<string> = new Set(Object.keys(CONDITION_OPS));

/**
 * Every member one nested object declares that this checker reads no member by.
 *
 * It reports and drops nothing. The members beside it are ones the checker reads
 * off the shape its type declares, so the walks after this one still name the
 * duplicate id two rules answer and the weight one variant gives, and § 7 has
 * the operator read every defect at one poll.
 */
function strangeMembers(
  value: Readonly<Record<string, unknown>>,
  defined: ReadonlySet<string>,
  what: string,
  named: string,
  at: string,
  key?: FeatureKey,
): readonly Found[] {
  const all: Found[] = [];
  for (const member of Object.keys(value)) {
    if (defined.has(member)) continue;
    all.push(
      unreadable(
        `${named} declares "${member}" on the ${what} at ${at}, and this checker reads no member by that name, so a holder installing this document would evaluate it as though the member were absent`,
        `${at}/${token(member)}`,
        key,
      ),
    );
  }
  return all;
}

/** Nothing the walks after it can read, for a definition that is not an object. */
const UNREADABLE: Readable = { variants: false, rules: false };

/** The set a row carries where the checker walked the conditions of every rule. */
const EMPTY: ReadonlySet<unknown> = new Set();

/**
 * What one rule's conditions leave the walks after this one.
 *
 * `refused` is a condition this checker could not read, and the rule gives up
 * its derived id over it. Three defects land there. `conditionText` has no text
 * for a `field`, an `op` or a day-of-week `zone` that is not a string, a holder
 * dereferences a day-of-week `value` that is not an array (`evaluateCondition` at
 * `conditions.ts:66` calls `includes` on it), and `weekdayIn` at
 * `conditions.ts:31-33` raises on a `zone` string this runtime formats nothing
 * by. The second and the third leave `conditionText` able to write the condition,
 * and the rule gives up the derived id anyway, because a document carrying any of
 * the three is one no caller installs.
 *
 * `strange` is what it read and has no code for: a member name it reads nothing
 * by, and an operator it dispatches nothing on. Neither costs the derivation
 * anything, because `conditionText` writes `field`, `op` and the value and this
 * rule still carries all three.
 */
interface ConditionIssues {
  readonly refused: readonly Found[];
  readonly strange: readonly Found[];
  /**
   * The conditions `refused` names, by their index in `when`. The derivation
   * probe reads the rest, and `unnameable` walks the same set, so the one poll
   * § 7 asks for carries both a shape defect in one condition and a value the
   * derivation raises on in another.
   */
  readonly refusedAt: ReadonlySet<number>;
}

/**
 * Every member of one rule's rollout that did not reach this holder whole.
 *
 * § 3 has every member the assignment algorithm reads travel whole or the
 * document is refused, and `percent` is the member `inRollout` at
 * `bucketing.ts:196` reads. It answers `false` for a `percent` that is not a
 * positive number, so a control plane that dropped the member from a 50% ramp
 * serves a document this holder installs and resolves off for every subject,
 * and neither side reports anything. `by` and `seed` decide which subjects the
 * ramp reaches at all: `rolloutField` and `rolloutSeed` in `evaluate.ts` read
 * both, and `rolloutText` writes them into the rule's derived id.
 *
 * A rollout that is not an object is read by nothing at all. `isRecord` refuses
 * an array, and `evaluate` reads `rule.rollout.percent` off a number as
 * `undefined`, so `rollout: [50]` and `rollout: 50` each put every subject
 * outside the ramp in silence.
 */
function rolloutIssues(
  rule: Readonly<Record<string, unknown>>,
  named: string,
  at: string,
  key?: FeatureKey,
): readonly Found[] {
  const rollout: unknown = rule['rollout'];
  if (rollout === undefined) return [];
  const path = `${at}/rollout`;
  if (!isRecord(rollout)) {
    return [
      unreadable(
        `${named} declares "rollout" on the rule at ${at} as ${met(rollout)}, and this checker reads an object carrying "percent"`,
        path,
        key,
      ),
    ];
  }

  const all: Found[] = [
    ...strangeMembers(rollout, ROLLOUT, 'rollout', named, path, key),
  ];

  const percent: unknown = rollout['percent'];
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    all.push(
      unreadable(
        `${named} declares "percent" on the rollout at ${path} as ${met(percent)}, and this checker reads the finite number the ramp reaches its share of subjects by, so a holder installing this document would put every subject outside it`,
        `${path}/percent`,
        key,
      ),
    );
  }

  for (const member of ['by', 'seed'] as const) {
    const value: unknown = rollout[member];
    if (value === undefined || typeof value === 'string') continue;
    all.push(
      unreadable(
        `${named} declares "${member}" on the rollout at ${path} as ${met(value)}, and this checker reads a string`,
        `${path}/${member}`,
        key,
      ),
    );
  }

  return all;
}

/**
 * Whether this runtime formats a time zone by that name.
 *
 * `weekdayIn` at `conditions.ts:31-33` builds
 * `new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' })`, and
 * that constructor raises `RangeError: Invalid time zone specified` for a name
 * the runtime has no zone for. `errors.ts:3-5` promises `resolve`, `plan` and
 * `toggle` are total, so one dropped letter in a control plane's zone column
 * would otherwise turn the first `resolve` carrying a `now` into a raise from a
 * call the author never made.
 *
 * The probe is the constructor call the evaluation makes, so what this checker
 * accepts is what this runtime formats. `Intl.supportedValuesOf` answers a list
 * that excludes a link such as `Asia/Calcutta`, which `DateTimeFormat` resolves
 * and `weekdayIn` reads a weekday off.
 */
function zoned(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' });
    return true;
  } catch {
    return false;
  }
}

/** Every condition of one rule the checker cannot read, and every member it does not know. */
function conditionIssues(
  rule: Readonly<Record<string, unknown>>,
  named: string,
  at: string,
  key?: FeatureKey,
): ConditionIssues {
  const when: unknown = rule['when'];
  const nowhere: ReadonlySet<number> = new Set();
  if (when === undefined)
    return { refused: [], strange: [], refusedAt: nowhere };
  if (!Array.isArray(when)) {
    return {
      refused: [
        unreadable(
          `${named} declares "when" on the rule at ${at} as ${met(when)}, and this checker reads an array of conditions`,
          `${at}/when`,
          key,
        ),
      ],
      strange: [],
      refusedAt: nowhere,
    };
  }

  const conditions: readonly unknown[] = dense(when);
  const refused: Found[] = [];
  const strange: Found[] = [];
  const refusedAt = new Set<number>();
  conditions.forEach((condition, inside) => {
    const path = `${at}/when/${String(inside)}`;
    if (!isRecord(condition)) {
      refusedAt.add(inside);
      refused.push(
        unreadable(
          `${named} declares the condition at ${path} as ${met(condition)}, and this checker reads an object`,
          path,
          key,
        ),
      );
      return;
    }

    for (const member of ['field', 'op'] as const) {
      const value: unknown = condition[member];
      if (typeof value === 'string') continue;
      refusedAt.add(inside);
      refused.push(
        unreadable(
          `${named} declares "${member}" on the condition at ${path} as ${met(value)}, and this checker reads a string`,
          `${path}/${member}`,
          key,
        ),
      );
    }

    if (condition['op'] === 'day-of-week') {
      const zone: unknown = condition['zone'];
      if (typeof zone !== 'string') {
        refusedAt.add(inside);
        refused.push(
          unreadable(
            `${named} declares "zone" on the day-of-week condition at ${path} as ${met(zone)}, and this checker reads a time zone name`,
            `${path}/zone`,
            key,
          ),
        );
      } else if (!zoned(zone)) {
        refusedAt.add(inside);
        refused.push(
          unreadable(
            `${named} declares "zone" on the day-of-week condition at ${path} as ${JSON.stringify(zone)}, and this runtime formats no time zone by that name`,
            `${path}/zone`,
            key,
          ),
        );
      }
      const value: unknown = condition['value'];
      if (!Array.isArray(value)) {
        refusedAt.add(inside);
        refused.push(
          unreadable(
            `${named} declares "value" on the day-of-week condition at ${path} as ${met(value)}, and this checker reads an array of weekday names`,
            `${path}/value`,
            key,
          ),
        );
      }
    }

    const op: unknown = condition['op'];
    if (typeof op === 'string' && !OPS.has(op)) {
      strange.push(
        unreadable(
          `${named} declares "op" on the condition at ${path} as ${JSON.stringify(op)}, and this checker dispatches on no operator by that name, so a holder installing this document would resolve the rule off for every subject`,
          `${path}/op`,
          key,
        ),
      );
    }

    strange.push(
      ...strangeMembers(
        condition,
        op === 'day-of-week' ? DAY_OF_WEEK : CONDITION,
        'condition',
        named,
        path,
        key,
      ),
    );
  });

  return { refused, strange, refusedAt };
}

/**
 * One rule as the derivation probe reads it: the conditions this walk could read.
 *
 * § 7 has the checker report every issue it finds, and a rule carrying a shape
 * defect in one condition and a value `canonical` raises on in another carries
 * two. Asking `nameable` about the whole rule answers for the shape defect, which
 * `conditionIssues` already reported, and leaves the second value for the poll
 * after the operator fixed the first. The probe drops the conditions the walk
 * refused, so what it answers about is the rest of the rule.
 *
 * `unnameable` walks the same set and keeps the index of each condition in
 * `when`, so every pointer it writes names the row the document carries.
 *
 * A `when` that is not an array is dropped whole, because `evaluate.ts:53` and
 * `ruleId` both iterate it and the walk has already reported it. What is left of
 * the rule is what the probe answers about, and the rollout `ruleId` reads is
 * part of that.
 */
function walked(
  rule: Readonly<Record<string, unknown>>,
  refusedAt: ReadonlySet<number>,
): Rule {
  const when: unknown = rule['when'];
  if (when === undefined) return rule as unknown as Rule;
  if (!Array.isArray(when)) return { ...rule, when: [] } as unknown as Rule;
  if (refusedAt.size === 0) return rule as unknown as Rule;
  const conditions: readonly unknown[] = dense(when);
  return {
    ...rule,
    when: conditions.filter((_, inside) => !refusedAt.has(inside)),
  } as unknown as Rule;
}

/**
 * Every member a candidate document carries as something the checker cannot
 * read, and what each definition leaves the walks after it.
 *
 * The typed signature protects none of this. § 7 and § 9 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` are written for a
 * document that arrived over a transport, so `validateConfig` is called on the
 * `any` that `JSON.parse` returns and a control plane or a truncated body decides
 * what reaches each member. A bare `for...of` over `features`, over
 * `dependsOn` or over `variants` raises a `TypeError` out of the poller that
 * § 6's availability guarantee rests on, and the doc comment on `validateConfig`
 * promises the opposite.
 *
 * The code is `unknown-member`. § 3 gives it to a member a holder does not
 * understand and the 18 codes name no second envelope defect, and a `features`
 * holding an object is a member whose value this holder cannot read.
 *
 * The document itself is read before its `features`. A control plane answering a
 * poll with the body `null`, or with an empty body the binding reads as
 * `undefined`, hands this function a value that carries no members at all, and
 * § 6 has a holder that refuses a document keep the one it already installed.
 * That holder reads a `ValidationResult` here, not a raise.
 *
 * `enabled` is read for the reason `key` is. It is the one member every
 * definition must carry and it decides the answer: `evaluate` short-circuits on
 * `enabled === false` at `evaluate.ts:187` and hands the decision to the rules
 * otherwise, so a definition whose column a control plane renamed resolves off
 * with `reason: 'explicitly-off'` and one carrying the string `'yes'` resolves on
 * with `reason: 'default-on'`, and neither one reports anything. § 3 states it:
 * a producer that cannot emit a member this document requires emits a document
 * `validateConfig` refuses, and the issue names the member.
 *
 * `rule.id` is read because `ruleId` returns it unchanged and `ruleIdErrors` keys
 * a `Map<string, boolean>` on it. `{ id: 1 }` beside `{ id: '1' }` is two keys in
 * that map and one name in `Decision.rule`, which is the collision § 2 puts
 * `duplicate-rule-id` in place to prevent, and a non-string id violates the
 * declared `string` return of `ruleId` at `rule-id.ts:123` as well.
 *
 * `key` is read here and not only named in a message. Every other check hangs
 * off it: `graphErrors` dedupes on it, `resolveAll` writes it as a property of
 * the `Decisions` record, and `definitionOf` looks a definition up by it. A
 * document declaring two features keyed `{}` passes every other check and builds
 * a store where `Object.fromEntries` writes both to `"[object Object]"`, so the
 * second one answers for the first and nothing reports it.
 *
 * A rule's conditions are read because `ruleIdErrors` derives a name from them.
 * `conditionText` in `rule-id.ts` length-prefixes `field`, `op` and a
 * day-of-week `zone`, so a condition carrying any of the three as something
 * other than a string is one the derivation cannot walk. A day-of-week `value`
 * is read for `evaluateCondition`, which calls `includes` on it. A condition
 * carrying all four can still hold a `value` no canonical text covers, which
 * is what `nameable` asks of the rules whose conditions this walk read.
 *
 * Those condition shape issues reach both callers, and `arrayIsOrder` does not
 * separate them. `createFeatures` takes the `any` `JSON.parse` returns through
 * its inferring overload, which
 * `docs/superpowers/plans/2026-09-29-feature-config-distribution.md` names as a
 * real path and Task 8 documents, so a control plane's body reaches a store
 * through it. Every one of those defects raises out of `resolve`: `evaluate.ts:53`
 * iterates `rule.when`, `rule-id.ts:48` reads `condition.zone.length`,
 * `conditionText` length-prefixes `field` and `op` the same way,
 * `conditions.ts:66` calls `includes` on a day-of-week `value`, and
 * `conditions.ts:31-33` hands a day-of-week `zone` to `Intl.DateTimeFormat`, so
 * `errors.ts:3-11` has the raise happen where the configuration is supplied. A
 * TypeScript literal satisfies each of them by type but the zone, which is a
 * string either path may misspell. Either way the rule id walk skips a rule whose
 * conditions it cannot name.
 *
 * `served` separates the callers for the member walks, which refuse a member no
 * shape below a definition names and an operator no condition type declares.
 * Nothing raises on either: a holder reads the members its own types declare,
 * evaluates the rest as absent, and answers an operator it has no branch for as
 * false. That is the § 3 defect a document carries and the literal path's
 * compiler already answers.
 */
function shapeWalk(
  config: Checkable,
  options: VariantCheckOptions,
): {
  readonly issues: readonly Found[];
  readonly rows: readonly Readable[];
} {
  const served = options.arrayIsOrder !== true;
  if (!isRecord(config)) {
    return {
      issues: [
        found(
          'unknown-member',
          new FeatureConfigError(
            `the document is ${met(config)}, and this checker reads an object carrying "features"`,
          ),
        ),
      ],
      rows: [],
    };
  }

  const definitions: unknown = config.features;
  if (!Array.isArray(definitions)) {
    return {
      issues: [
        unreadable(
          `the document declares "features" as ${met(definitions)}, and this checker reads an array of definitions`,
          '/features',
        ),
      ],
      rows: [],
    };
  }

  const definitionRows: readonly unknown[] = served
    ? dense(definitions)
    : definitions;
  const all: Found[] = [];
  const rows: Readable[] = [];

  definitionRows.forEach((definition, at) => {
    if (!isRecord(definition)) {
      all.push(
        unreadable(
          `the definition at /features/${String(at)} is ${met(definition)}, and this checker reads an object`,
          pointer(at),
        ),
      );
      rows.push(UNREADABLE);
      return;
    }

    const key = keyOf(definition);
    const named =
      key === undefined
        ? `the definition at /features/${String(at)}`
        : `feature "${String(key)}"`;

    if (key === undefined) {
      all.push(
        unreadable(
          `${named} declares "key" as ${met(definition['key'])}, and this checker reads a string or a number`,
          pointer(at, 'key'),
        ),
      );
    }

    const enabled: unknown = definition['enabled'];
    if (typeof enabled !== 'boolean') {
      all.push(
        unreadable(
          `${named} declares "enabled" as ${met(enabled)}, and this checker reads a boolean`,
          pointer(at, 'enabled'),
          key,
        ),
      );
    }

    if (served) {
      for (const member of Object.keys(definition)) {
        if (DEFINED.has(member)) continue;
        all.push(
          unreadable(
            `${named} declares "${member}", and this checker reads no member by that name, so a holder installing this document would evaluate it as though the member were absent`,
            pointer(at, member),
            key,
          ),
        );
      }

      for (const member of ['seed', 'freezeTimeAtBuild'] as const) {
        const value: unknown = definition[member];
        if (value === undefined || typeof value === SCALARS[member].type)
          continue;
        all.push(
          unreadable(
            `${named} declares "${member}" as ${met(value)}, and this checker reads ${SCALARS[member].reads}`,
            pointer(at, member),
            key,
          ),
        );
      }
    }

    const shapes: Record<'dependsOn' | 'variants' | 'rules', boolean> = {
      dependsOn: true,
      variants: true,
      rules: true,
    };

    for (const member of ['dependsOn', 'variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (value === undefined || Array.isArray(value)) continue;
      shapes[member] = false;
      all.push(
        unreadable(
          `${named} declares "${member}" as ${met(value)}, and this checker reads ${MEMBERS[member]}`,
          pointer(at, member),
          key,
        ),
      );
    }

    const declared: unknown = definition['dependsOn'];
    let dependsOn: readonly FeatureKey[] | undefined;
    if (shapes.dependsOn && Array.isArray(declared)) {
      const elements: readonly unknown[] = served ? dense(declared) : declared;
      // The elements that answered `isKey`. An element the checker could not
      // read costs the graph that one edge and no other: the siblings name rows
      // the document declares, and a walk over a subset of the edges reports no
      // cycle and no unknown dependency the whole set does not carry. § 7 has
      // the operator who drops the element meet no issue that was in the
      // document all along.
      const edges: FeatureKey[] = [];
      elements.forEach((element, inside) => {
        if (isKey(element)) {
          edges.push(element);
          return;
        }
        all.push(
          unreadable(
            `${named} declares the dependency at ${pointer(at, 'dependsOn')}/${String(inside)} as ${met(element)}, and this checker reads a key`,
            `${pointer(at, 'dependsOn')}/${String(inside)}`,
            key,
          ),
        );
      });
      dependsOn = edges;
    }

    // The elements of each member the checker read, and whether those are every
    // element the document declares. An element it could not read costs the
    // walks after it that one element, so the duplicate name two readable
    // variants carry and the id two readable rules answer are still reported.
    const read: Record<'variants' | 'rules', unknown[]> = {
      variants: [],
      rules: [],
    };
    const every: Record<'variants' | 'rules', boolean> = {
      variants: true,
      rules: true,
    };
    // The rules whose conditions this walk refused, which the id walk names by
    // what each one declares. An element-level defect costs the walks beside it
    // that one element, and the conditions of one rule are as much an element
    // as the id of one rule is.
    const unwalked = new Set<unknown>();
    // The index each rule in `read.rules` holds in the array the document
    // declares.
    const ruleAt: number[] = [];

    for (const member of ['variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (!shapes[member] || !Array.isArray(value)) continue;
      const elements: readonly unknown[] = served ? dense(value) : value;
      elements.forEach((element, inside) => {
        const path = `${pointer(at, member)}/${String(inside)}`;
        if (!isRecord(element)) {
          every[member] = false;
          all.push(
            unreadable(
              `${named} declares the ${ELEMENTS[member]} at ${path} as ${met(element)}, and this checker reads an object`,
              path,
              key,
            ),
          );
          return;
        }
        if (member !== 'rules') {
          if (served) {
            all.push(
              ...strangeMembers(element, VARIANT, 'variant', named, path, key),
            );
          }
          read.variants.push(element);
          return;
        }
        const id: unknown = element['id'];
        const readableId = id === undefined || typeof id === 'string';
        if (!readableId) {
          every.rules = false;
          all.push(
            unreadable(
              `${named} declares "id" on the rule at ${path} as ${met(id)}, and this checker reads a string`,
              `${path}/id`,
              key,
            ),
          );
        }
        if (served) {
          all.push(
            ...strangeMembers(element, RULE, 'rule', named, path, key),
            ...rolloutIssues(element, named, path, key),
          );
        }
        const inner = conditionIssues(element, named, path, key);
        all.push(...inner.refused);
        if (served) all.push(...inner.strange);
        if (inner.refused.length > 0) unwalked.add(element);
        if (id === undefined && !nameable(walked(element, inner.refusedAt))) {
          // A rule this walk cannot name is a rule no caller can evaluate, so it
          // is reported here rather than dropped. `ruleIdErrors` skips it after
          // this, the way it skips a rule whose `when` the walk refused.
          unwalked.add(element);
          all.push(...unnameable(element, named, path, key, inner.refusedAt));
        }
        // A rule whose id is not a string is one `ruleIdErrors` would key its
        // map on, so it is the one rule the id walk drops.
        if (readableId) {
          read.rules.push(element);
          ruleAt.push(inside);
        }
      });
    }

    rows.push({
      ...(key === undefined ? {} : { key }),
      ...(dependsOn === undefined ? {} : { dependsOn }),
      variants: shapes.variants,
      ...(shapes.variants ? {} : { unreadVariants: true }),
      rules: shapes.rules,
      ...(unwalked.size === 0 ? {} : { unwalked }),
      // Each element answered `isRecord` above, which is the shape the walks
      // after this one read their members off.
      ...(every.variants
        ? {}
        : { someVariants: read.variants as readonly VariantSpec[] }),
      ...(every.rules
        ? {}
        : { someRules: read.rules as readonly Rule[], someRuleAt: ruleAt }),
    });
  });

  return { issues: all, rows };
}

/**
 * Whether `ruleId` can name a rule, which every decision naming it needs.
 *
 * `canonical` recurses through an `AttributeCondition.value` and writes its memo
 * entry after the recursion at `canonical.ts:138`, so a value that holds itself
 * raises `RangeError: Maximum call stack size exceeded` and one whose sharing
 * expands past 26 levels raises `RangeError: Invalid string length`.
 * `instantText` at `rule-id.ts:16-22` hands a window condition's value to
 * `RegExp.prototype.test`, which coerces it with `ToString`, and an object whose
 * `toString` and `valueOf` are both non-callable raises a `TypeError` there.
 *
 * Every raise answers the question alike, so the catch narrows to none of them.
 * A control plane chooses what reaches a condition value, § 7 has the checker
 * return a `ValidationResult` for whatever it chose, and `validateConfig`'s own
 * contract is that nothing about the argument is trusted. A catch keyed on one
 * constructor makes the next value class a poller meets a raise that names no
 * feature.
 *
 * Reporting it is what keeps `errors.ts:3-11` true. `ruleId` runs again on every
 * evaluation -- the `WeakMap` at `rule-id.ts:105` holds an entry only for a rule
 * it named -- so a store built over such a rule raises the same error out of
 * `resolve`, and `resolve`, `plan` and `toggle` are total.
 *
 * Only a rule declaring no `id` is asked. `ruleId` returns a declared id without
 * reading the conditions, so no canonical text is taken of them on either path.
 */
function nameable(rule: Rule): boolean {
  try {
    ruleId(rule);
    return true;
  } catch {
    return false;
  }
}

/**
 * The value a rule's derivation raises on, as the issue that names it.
 *
 * `nameable` asks the whole rule, and this walks the conditions one at a time to
 * say which value raised. `canonical` takes a fresh memo per call at
 * `canonical.ts:73`, so a condition this walk names on its own is one the rule's
 * derivation names beside the others.
 *
 * A window condition answers `invalid-instant`. § 8 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` gives that code to a
 * condition value this checker cannot read as a point in time, and the raise
 * comes out of `instantText` at `rule-id.ts:16-22`, which hands the value to
 * `RegExp.prototype.test`. An operator routing on the code reads the member to
 * fix, and `unknown-member` would send them looking for a member to add.
 *
 * Every other condition answers `unknown-member`, which is the code this walk
 * reports every value it cannot read as. The 18 codes name no second one for a
 * value `canonical` has no text for.
 *
 * Every condition is walked, and not only the first one that raises. § 7 has the
 * checker report every issue it finds, and an operator who fixes the value one
 * refusal names would otherwise meet the second condition for the first time at
 * the next poll.
 *
 * The conditions `conditionIssues` refused are skipped, because that walk already
 * named each one at the member it refused. `walked` drops the same set from the
 * rule the probe asks about, so the two walks answer about one rule.
 *
 * The rule is what the fallback names, and the pointer stops at the rule. Every
 * part of the rule has been probed by then, and a rule declaring no `when` is
 * one this walk has already read `conditions.length === 0` off, so a pointer at
 * a member would send the operator to a row the document may not carry.
 * `ruleId` joins the text of every part before it hashes, so what reaches here
 * is a rule whose parts each fit the string ceiling and whose joined text does
 * not.
 *
 * The rollout is walked after the conditions, because `ruleId` reads it too.
 * `rolloutText` canonicalises `{ by, seed }`, so a `by` that holds itself raises
 * where no condition does, and on a rule declaring no `when` there is no
 * condition to send the operator to at all. `rolloutIssues` names the same two
 * members for a served document and runs for that caller alone, so this walk is
 * the whole of what an author calling `createFeatures` reads.
 */
function unnameable(
  rule: Readonly<Record<string, unknown>>,
  named: string,
  at: string,
  key: FeatureKey | undefined,
  refusedAt: ReadonlySet<number>,
): readonly Found[] {
  const when: unknown = rule['when'];
  const conditions: readonly unknown[] = Array.isArray(when) ? dense(when) : [];
  const all: Found[] = [];
  conditions.forEach((condition, inside) => {
    if (refusedAt.has(inside)) return;
    if (nameable({ when: [condition] } as unknown as Rule)) return;
    const path = `${at}/when/${String(inside)}/value`;
    const op: unknown = isRecord(condition) ? condition['op'] : undefined;
    if (op === 'before' || op === 'after') {
      all.push(
        found(
          'invalid-instant',
          new FeatureConfigError(
            `${named} declares the instant at ${path} as a value this checker cannot read as a point in time, and the derivation a decision reads this rule's id from raises on it`,
          ),
          key,
          path,
        ),
      );
      return;
    }
    all.push(
      unreadable(
        `${named} declares the value at ${path} as one no canonical text names, and the derivation a decision reads this rule's id from raises on it`,
        path,
        key,
      ),
    );
  });

  // `rolloutText` destructures `by` and `seed` off anything truthy, arrays
  // included, so the probe reads them off the same shapes the derivation does.
  const rollout: unknown = rule['rollout'];
  if (typeof rollout === 'object' && rollout !== null) {
    const members = rollout as Readonly<Record<string, unknown>>;
    for (const member of ['by', 'seed'] as const) {
      const probe = { rollout: { [member]: members[member] } };
      if (nameable(probe as unknown as Rule)) continue;
      const path = `${at}/rollout/${member}`;
      all.push(
        unreadable(
          `${named} declares the value at ${path} as one no canonical text names, and the derivation a decision reads this rule's id from raises on it`,
          path,
          key,
        ),
      );
    }
  }

  if (all.length > 0) return all;
  return [
    unreadable(
      `${named} declares a rule at ${at} carrying a value no canonical text names, and the derivation a decision reads this rule's id from raises on it`,
      at,
      key,
    ),
  ];
}

/**
 * Two rules of one feature answering one id.
 *
 * The comparison runs over the id `ruleId` answers for each rule, which is the
 * name `Decision.rule` and `RuleOutcome.rule` both carry, and not over the ids
 * two rules declare. § 2 puts the check in place because two rules answering one
 * name make "a dashboard keyed on that name report two rules as one", and a rule
 * declaring no `id` is named by a hash of what it matches on, so a declared id
 * and a derived one collide on that name as readily as two declared ones.
 * `rolloutText` excludes `rollout.percent`, which is what makes two ramps on one
 * feature over one condition set the reachable case: both rules match, both
 * derive one id, and a decision naming it names both.
 *
 * It runs that way for both callers. The Testing section of the spec has
 * `serializeConfig(features)` through a JSON hop and `parseFeatureConfig` produce
 * a store whose `config` deep-equals the original, and Decision 11 has one
 * checker answer for both envelopes, so two rules of one feature that derive one
 * id are refused where the configuration is supplied rather than at the first
 * poll of the document a store emitted.
 *
 * `unwalked` holds the rules whose conditions the shape walk refused or could not
 * name, and those are read for the id they declare. A hash of what such a rule
 * matches on is a hash this checker cannot take, and the id it declares is the
 * name a decision carries either way, so two rules declaring one id are reported
 * although one of them carries a `when` the operator has yet to fix. A rule in
 * there declaring no id is the one rule the walk drops, which is what an
 * unreadable `rule.id` gets.
 *
 * `ruleId` is called unguarded, because the shape walk called `nameable` on every
 * rule that reaches here and put the ones it cannot name in `unwalked`.
 */
function ruleIdErrors(
  definition: FeatureDefinition<FeatureKey>,
  unwalked: ReadonlySet<unknown>,
): readonly FeatureConfigError[] {
  const declaredFirst = new Map<string, boolean>();
  const errors: FeatureConfigError[] = [];
  for (const rule of definition.rules ?? []) {
    const declared = rule.id !== undefined;
    const id = unwalked.has(rule) ? rule.id : ruleId(rule);
    if (id === undefined) continue;
    const first = declaredFirst.get(id);
    if (first === undefined) {
      declaredFirst.set(id, declared);
      continue;
    }
    errors.push(
      new FeatureConfigError(
        first && declared
          ? `feature "${String(definition.key)}" declares the rule id "${id}" twice`
          : `feature "${String(definition.key)}" answers the rule id "${id}" for two rules, and a decision that names it names both`,
      ),
    );
  }
  return errors;
}

/** The six members an envelope carries. A seventh refuses the document. */
const ENVELOPE_MEMBERS: ReadonlySet<string> = new Set([
  'version',
  'digest',
  'schema',
  'schemaVersion',
  'maxStale',
  'features',
]);

/**
 * A member this holder cannot read refuses the whole document.
 *
 * GrowthBook's payload builder strips a rule key an SDK connection does not
 * declare support for, and the SDK then reads `experiment.hashVersion || 1`,
 * which puts that traffic back on the hashing GrowthBook's own documentation
 * calls biased, with no warning on either side. Two properties combine to
 * produce that: the producer removes a member the consumer needs, and the
 * consumer defaults the missing member to a value that changes an answer.
 *
 * This refuses both. The holder drops nothing and evaluates nothing, and the
 * issue names the member. The cost is availability, and § 6 bounds it: a
 * refused candidate leaves the installed document deciding.
 *
 * `Object.keys` reads own enumerable keys alone, so a document parsed from JSON
 * text carrying `"__proto__"` surfaces the member here and writes no prototype.
 */
function memberIssues(
  config: Readonly<Record<string, unknown>>,
): readonly Found[] {
  return Object.keys(config)
    .filter((member) => !ENVELOPE_MEMBERS.has(member))
    .map((member) =>
      found(
        'unknown-member',
        new FeatureConfigError(
          `the document carries the member "${member}", which this holder cannot read`,
        ),
        undefined,
        `/${token(member)}`,
      ),
    );
}

/**
 * The text a message reads a stated digest as.
 *
 * `configDigest` writes 32 hex characters, and the member a document states
 * holds whatever `JSON.parse` returned. An object whose `toString` and
 * `valueOf` are both non-callable raises `TypeError: Cannot convert object to
 * primitive value` where a template reads it, so the message names what the
 * member carries wherever it carries no string.
 */
function stated(digest: unknown): string {
  return typeof digest === 'string' ? digest : met(digest);
}

/**
 * The digest a document states, against the digest its content takes.
 *
 * `configDigest` removes `digest` and `version` and canonicalises the rest, so
 * the publisher that wrote the member and the holder that reads it hash the same
 * text. A document carrying no digest states nothing to verify.
 */
function digestIssues(config: Checkable): readonly Found[] {
  if (config.digest === undefined) return [];
  // `FeatureConfig` narrows a window instant and a condition value, and
  // `configDigest` reads neither: it canonicalises the document whole. The
  // assertion is what lets the checker's wider element type reach it.
  let derived: string;
  try {
    derived = configDigest(config as FeatureConfig);
  } catch (raise) {
    // `canonical` recurses at `canonical.ts:128`, so a value nested deeper
    // than the stack holds raises here rather than at a walk that reads a
    // member. Nothing about the document is trusted, and a holder that cannot
    // digest the content cannot verify the digest it states, so the document is
    // refused with the raise as the member it could not read. No pointer names
    // the value: the canonicaliser walks the document whole and reports no
    // position.
    return [
      found(
        'unknown-member',
        new FeatureConfigError(
          `the document states the digest ${stated(config.digest)} and its content digests to nothing this checker can read: ${raise instanceof Error ? raise.message : String(raise)}`,
        ),
      ),
    ];
  }
  if (derived === config.digest) return [];
  return [
    found(
      'digest-mismatch',
      new FeatureConfigError(
        `the document states the digest ${stated(config.digest)} and its content digests to ${derived}`,
      ),
      undefined,
      '/digest',
    ),
  ];
}

/**
 * An inline schema states its own version.
 *
 * A schema is immutable at its `schemaVersion`, so a document naming `s7` and a
 * schema published at `s7` cannot disagree. An inline schema nobody can name
 * cannot be cached, compared or fetched again. A document carrying neither
 * member declares no shapes, which is what a configuration with no variant
 * values looks like.
 */
function schemaVersionIssues(config: Checkable): readonly Found[] {
  if (config.schema === undefined || config.schemaVersion !== undefined) {
    return [];
  }
  return [
    found(
      'missing-schema-version',
      new FeatureConfigError(
        'the document carries an inline schema and no schemaVersion, so no holder can cache it',
      ),
      undefined,
      '/schema',
    ),
  ];
}

/** What a `ValueShape` may use. */
const FENCED: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'const',
  'additionalProperties',
  '$defs',
  '$ref',
  'title',
  'description',
]);

/** The keywords whose value is a map from an author's name to a shape. */
const SHAPE_MAPS: ReadonlySet<string> = new Set(['properties', '$defs']);

/** The keywords whose value is one shape. */
const SHAPE_SLOTS: ReadonlySet<string> = new Set([
  'items',
  'additionalProperties',
]);

/**
 * The fence, walked over one variant value shape by keyword position.
 *
 * A key is tested against the fence only where a shape declares a keyword.
 * `properties` and `$defs` hold a map from a name their author chose to a
 * shape, so the walk descends into each value and tests no name: a property
 * called `label` and a definition called `Label` are data. `items` and
 * `additionalProperties` hold one shape, so the walk descends into the value
 * itself. `type`, `title`, `description`, `required`, `enum` and `const` hold
 * data and the walk stops at them, so a variant value carrying the key `oneOf`
 * under a `const` stays legal. `$ref` holds a string and the walk checks its
 * prefix.
 *
 * A walk that tested every key of every nested object would refuse
 * `{ $defs: { Label: { type: 'string' } }, type: 'object', properties: { label:
 * { $ref: '#/$defs/Label' } } }`, which is a document the fence accepts: it
 * would test `FENCED.has('label')` and `FENCED.has('Label')` and report two
 * `unfenced-schema` issues.
 *
 * A remote `$ref` makes the document one a generator cannot resolve offline,
 * and `allOf`, `anyOf`, `oneOf` and `not` produce Swift and Kotlin a reader
 * cannot map back to the schema. An owner needing a union writes an `enum` over
 * a discriminant.
 */
function shapeIssues(shape: unknown, path: string): readonly Found[] {
  if (!isRecord(shape)) return [];

  const issues: Found[] = [];
  for (const [keyword, held] of Object.entries(shape)) {
    const at = `${path}/${token(keyword)}`;

    if (keyword === '$ref') {
      if (typeof held !== 'string' || !held.startsWith('#/$defs/')) {
        issues.push(
          found(
            'unfenced-schema',
            new FeatureConfigError(
              `the value shape at ${at} references ${String(held)}, and a shape may reference only a $defs entry in the same document`,
            ),
            undefined,
            at,
          ),
        );
      }
      continue;
    }

    if (!FENCED.has(keyword)) {
      issues.push(
        found(
          'unfenced-schema',
          new FeatureConfigError(
            `the value shape at ${at} uses the keyword "${keyword}", which the fence refuses`,
          ),
          undefined,
          at,
        ),
      );
      continue;
    }

    if (SHAPE_MAPS.has(keyword)) {
      if (!isRecord(held)) continue;
      for (const [name, nested] of Object.entries(held)) {
        issues.push(...shapeIssues(nested, `${at}/${token(name)}`));
      }
      continue;
    }

    if (SHAPE_SLOTS.has(keyword)) {
      issues.push(...shapeIssues(held, at));
    }
  }
  return issues;
}

/**
 * Every variant value shape a document's inline schema declares, fenced.
 *
 * The walk descends through a shape position alone, so it reaches every keyword
 * an author wrote as a keyword and tests no name an author chose.
 * `additionalProperties: false` stops the walk at a boolean, and
 * `required: ['label']` stops it at an array of strings. A `oneOf` written as a
 * keyword is refused at any depth, and a `oneOf` written as a property name or
 * as a key inside a `const` is data and passes.
 */
function schemaIssues(config: Checkable): readonly Found[] {
  const features: unknown = config.schema?.features;
  if (!isRecord(features)) return [];
  return Object.entries(features).flatMap(([key, shape]) => {
    if (!isRecord(shape)) return [];
    const variants: unknown = shape['variants'];
    if (!isRecord(variants)) return [];
    return Object.entries(variants).flatMap(([variant, value]) =>
      shapeIssues(
        value,
        `/schema/features/${token(key)}/variants/${token(variant)}`,
      ).map((each) => ({ ...each, issue: { ...each.issue, key } })),
    );
  });
}

/** The base of a declared type, with the array and optional suffixes stripped. */
function baseOf(declared: FieldType): { base: string; array: boolean } {
  const withoutOptional = declared.endsWith('?')
    ? declared.slice(0, -1)
    : declared;
  const array = withoutOptional.endsWith('[]');
  return {
    base: array ? withoutOptional.slice(0, -2) : withoutOptional,
    array,
  };
}

/**
 * Whether an operator fits a declared type.
 *
 * `contains` asks whether an array holds a value, so the declared field is an
 * array. `in` and `not-in` ask whether a scalar is a member of a literal list,
 * so the declared field is a scalar. `eq` and `ne` compare with `===`, which
 * never holds for two arrays, so they take a scalar too. `before` and `after`
 * read `now` and reach no declared field.
 */
function operatorFits(op: string, declared: FieldType): boolean {
  const { array } = baseOf(declared);
  if (op === 'contains') return array;
  return !array;
}

/**
 * Every condition of one definition the document's own declarations refuse.
 *
 * A window condition is read as a point in time, for both callers. `toEpoch` at
 * `conditions.ts:18-22` reads a string through `Date.parse` and answers `NaN`
 * for one it cannot read, and `evaluateCondition` compares against that `NaN`,
 * so `'next tuesday'` resolves the rule off for every subject and neither side
 * reports anything. `invalid-instant` names the member.
 *
 * `'2026-10-01T00:00:00'` parses, so this walk accepts it. ECMA-262 reads a
 * date-time string carrying no offset as local time, which puts the window at a
 * different instant in Stockholm and in Tokyo, and issue #284 owns that.
 *
 * The context fields are read where the document declares them. A condition over
 * a field the schema omits answers `unknown-context-field`, and an operator the
 * declared type has no meaning for answers `field-type-mismatch`: `contains`
 * over a declared `boolean` asks whether a boolean holds a value, which
 * `evaluateCondition` answers `false` for every subject. A document declaring no
 * context fields declares no contract, and this walk reads its instants alone.
 *
 * The field lookup goes through `hasOwnProperty`, for the reason
 * `conditions.ts:80-83` and `variants.ts:196-200` already give: a bare index
 * walks the prototype chain, so a field named `constructor` reads a function off
 * `Object.prototype` and the check would pass a field nobody declared.
 *
 * A `field` or an `op` the shape walk refused is skipped. That walk reported the
 * member, and a lookup keyed on a number would name a field no document carries.
 *
 * Both walks run for a served document alone, for the reason the member walks
 * do. Neither defect raises anything out of `resolve`: `toEpoch` answers `NaN`
 * and `evaluateCondition` compares against it as `false`, and a condition over a
 * field a context omits reads `undefined` and compares as `false`. The plan's
 * global constraints hold `createFeatures` to the six error classes it throws
 * today plus the five condition shapes Task 4 added, and `serialize.spec.ts`
 * builds a store over `new Date(NaN)` to prove `serializeConfig` refuses the
 * value JSON cannot carry. An author writing a literal reads the refusal off the
 * document their own store serves.
 */
function whenIssues(
  definition: FeatureDefinition<FeatureKey>,
  at: number,
  fields: Readonly<Record<string, FieldType>> | undefined,
  positions: readonly number[] | undefined,
): readonly Found[] {
  const issues: Found[] = [];
  const rules: readonly Rule[] = Array.isArray(definition.rules)
    ? definition.rules
    : [];
  rules.forEach((rule, walkedAt) => {
    // The index the document declares this rule at. The rules are the ones the
    // shape walk read, and it reads past an element it refused, so a pointer
    // built from the position in this array would name the rule the document
    // carries one place earlier.
    const ruleAt = positions?.[walkedAt] ?? walkedAt;
    const when: readonly Condition[] = Array.isArray(rule.when)
      ? rule.when
      : [];
    when.forEach((condition, whenAt) => {
      if (!isRecord(condition)) return;
      if (typeof condition.field !== 'string') return;
      if (typeof condition.op !== 'string') return;
      const path = `${pointer(at, 'rules')}/${String(ruleAt)}/when/${String(whenAt)}`;

      if (condition.op === 'before' || condition.op === 'after') {
        // `windowFault` reads the three forms an `Instant` is written in. A
        // served document carries whatever JSON held, so a value outside them
        // reaches here, and `canonical` writes its members rather than raising,
        // which leaves the derivation nothing to report.
        const value: unknown = condition.value;
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          !(value instanceof Date)
        ) {
          issues.push(
            found(
              'invalid-instant',
              new FeatureConfigError(
                `feature "${String(definition.key)}" declares the instant at ${path}/value as a value this checker cannot read as a point in time, and the derivation a decision reads this rule's id from raises on it`,
              ),
              definition.key,
              `${path}/value`,
            ),
          );
          return;
        }
        const fault = windowFault(condition.value);
        if (fault !== undefined) {
          issues.push(
            found(
              'invalid-instant',
              new FeatureConfigError(
                `feature "${String(definition.key)}" has a rule whose "${condition.op}" condition ${fault}`,
              ),
              definition.key,
              `${path}/value`,
            ),
          );
        }
        return;
      }

      if (condition.op === 'day-of-week') return;
      if (!fields) return;

      const declared = Object.prototype.hasOwnProperty.call(
        fields,
        condition.field,
      )
        ? fields[condition.field]
        : undefined;

      if (declared === undefined) {
        issues.push(
          found(
            'unknown-context-field',
            new FeatureConfigError(
              `feature "${String(definition.key)}" reads the context field "${condition.field}", which the schema does not declare`,
            ),
            definition.key,
            `${path}/field`,
          ),
        );
        return;
      }

      if (!operatorFits(condition.op, declared)) {
        issues.push(
          found(
            'field-type-mismatch',
            new FeatureConfigError(
              `feature "${String(definition.key)}" applies "${condition.op}" to the context field "${condition.field}", which the schema declares ${declared}`,
            ),
            definition.key,
            `${path}/op`,
          ),
        );
      }
    });
  });
  return issues;
}

/**
 * Every defect the envelope carries, read before its payload.
 *
 * A document that is not an object carries no members at all, and the shape walk
 * reports that one. These four read members off an object, so they run where
 * there is an object to read them off.
 */
function envelopeIssues(config: Checkable): readonly Found[] {
  if (!isRecord(config)) return [];
  return [
    ...memberIssues(config),
    ...digestIssues(config),
    ...schemaVersionIssues(config),
    ...schemaIssues(config),
  ];
}

/**
 * Every defect in a document, in the order a reader meets them.
 *
 * The shape walk comes first, and each member it could not read stops that
 * member's walk and no other. § 7 has `validateConfig` report every issue it
 * finds, so a document whose 38th row carries a `variants` object still reports
 * the duplicate key its 3rd and 10th rows declare.
 *
 * Then the graph, because a duplicate key and an unknown dependency describe the
 * document as a whole. It walks the rows whose key the checker read, with the
 * edges it read, so no reported dependency and no reported cycle names a value
 * the document does not carry. Then each definition in document order, with its
 * variants and its rule ids.
 *
 * Not exported from the package. `validateConfig` is the public half and
 * `createFeatures` is the other caller.
 */
export function collectIssues(
  config: Checkable,
  options: VariantCheckOptions = {},
): readonly Found[] {
  const { issues, rows } = shapeWalk(config, options);
  const all: Found[] = [...envelopeIssues(config), ...issues];

  // The context fields the document declares, which every condition below is
  // read against.
  const fields = isRecord(config) ? config.schema?.context?.fields : undefined;

  const nodes: GraphNode<FeatureKey>[] = [];
  for (const row of rows) {
    if (row.key === undefined) continue;
    nodes.push({ key: row.key, dependsOn: row.dependsOn });
  }
  for (const error of graphErrors(nodes)) {
    all.push(
      found(
        graphCode(error),
        error,
        error instanceof DuplicateFeatureError ||
          error instanceof UnknownDependencyError
          ? error.key
          : undefined,
      ),
    );
  }

  rows.forEach((row, at) => {
    const definition = config.features[at];
    if (!definition) return;

    // The definition the walks below read, whose `variants` and `rules` hold
    // the elements the shape walk read. An element it could not read is the one
    // element they drop, and a member it could not read at all is one it strips,
    // so no walk below reads a value the shape walk has already reported.
    const walked: FeatureDefinition<FeatureKey> = {
      ...definition,
      variants: row.variants
        ? (row.someVariants ?? definition.variants)
        : undefined,
      rules: row.rules ? (row.someRules ?? definition.rules) : undefined,
    };

    // `variantErrors` reads `variants`, and reads `rules` for the variant pins
    // alone, so it runs wherever the checker read the variants and `rulePins`
    // carries what it made of the rules. It runs over a `variants` the checker
    // could not read as well, for the two bucketing members § 3 reads off the
    // definition.
    if (row.variants || row.unreadVariants) {
      for (const defect of variantErrors(walked, {
        ...options,
        rulePins: row.rules,
        everyVariant: row.someVariants === undefined,
        unreadVariants: row.unreadVariants === true,
      })) {
        all.push(
          found(defect.code, defect.error, row.key, pointer(at, defect.member)),
        );
      }
    }

    // `whenIssues` reads the conditions the shape walk read, against the
    // instants a window names and the context fields the document declares.
    if (options.arrayIsOrder !== true) {
      all.push(...whenIssues(walked, at, fields, row.someRuleAt));
    }

    // `ruleIdErrors` reads the rules the shape walk read, and names each one by
    // the conditions it walked or by the id the rule declares.
    if (!row.rules) return;
    for (const error of ruleIdErrors(walked, row.unwalked ?? EMPTY)) {
      all.push(
        found('duplicate-rule-id', error, row.key, pointer(at, 'rules')),
      );
    }
  });

  return all;
}

/**
 * Every defect in a candidate document, reported and not thrown.
 *
 * It reports all of them. A poller showing an operator one error per deploy
 * cycle is a poor tool when the row has four.
 *
 * Nothing about the argument is trusted. A caller hands this function whatever
 * `JSON.parse` returned from a control plane's body, so the checker reads every
 * member it walks and reports the ones it cannot read as `unknown-member`.
 *
 * A document reaches this function through a store and a code generator, so
 * every variant in it declares an `order` and every definition carrying variants
 * declares a `variantBy` and a `variantSeed`, or the document is refused. § 3
 * states why: a holder that fills one of those gaps with a default computes a
 * different assignment from the publisher and neither one reports anything.
 * `createFeatures` reads the literal an author wrote, where the array is the
 * order and the author who omitted a member is the party the default answers.
 *
 * `createFeatures` calls the same checker and throws the first issue as the
 * typed error it has always thrown, which keeps `errors.ts:3-11` true: every
 * error this library raises is raised where the configuration is supplied, and
 * `resolve`, `plan` and `toggle` stay total.
 */
export function validateConfig(config: FeatureConfig): ValidationResult {
  const all = collectIssues(config);
  if (all.length === 0) return { ok: true };
  return { ok: false, issues: all.map((each) => each.issue) };
}
