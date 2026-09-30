import { graphErrors } from './graph.js';
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
  ValidationResult,
} from './config.js';
import type { GraphNode } from './graph.js';
import type { VariantCheckOptions } from './variants.js';
import type {
  AttributeCondition,
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
 */
export interface Checkable {
  readonly features: readonly FeatureDefinition<FeatureKey>[];
}

/** The code a graph error reports as. */
function graphCode(error: FeatureConfigError): ConfigIssueCode {
  if (error instanceof DuplicateFeatureError) return 'duplicate-feature';
  if (error instanceof UnknownDependencyError) return 'unknown-dependency';
  if (error instanceof FeatureCycleError) return 'cycle';
  return 'duplicate-feature';
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

/** The pointer at a definition, and optionally at one of its members. */
function pointer(at: number, member?: string): string {
  return member === undefined
    ? `/features/${String(at)}`
    : `/features/${String(at)}/${member}`;
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
        `${at}/${member}`,
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
 * `refused` is a condition this checker could not read, which costs the rule its
 * derived id: `conditionText` has no text for it. `strange` is a member it read
 * the shape of and reads no member by, which costs the derivation nothing,
 * because `conditionText` writes `field`, `op` and the value and this rule still
 * carries all three.
 */
interface ConditionIssues {
  readonly refused: readonly Found[];
  readonly strange: readonly Found[];
}

/** Every condition of one rule the checker cannot read, and every member it does not know. */
function conditionIssues(
  rule: Readonly<Record<string, unknown>>,
  named: string,
  at: string,
  key?: FeatureKey,
): ConditionIssues {
  const when: unknown = rule['when'];
  if (when === undefined) return { refused: [], strange: [] };
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
    };
  }

  const conditions: readonly unknown[] = when;
  const refused: Found[] = [];
  const strange: Found[] = [];
  conditions.forEach((condition, inside) => {
    const path = `${at}/when/${String(inside)}`;
    if (!isRecord(condition)) {
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
        refused.push(
          unreadable(
            `${named} declares "zone" on the day-of-week condition at ${path} as ${met(zone)}, and this checker reads a time zone name`,
            `${path}/zone`,
            key,
          ),
        );
      }
    }

    strange.push(
      ...strangeMembers(
        condition,
        condition['op'] === 'day-of-week' ? DAY_OF_WEEK : CONDITION,
        'condition',
        named,
        path,
        key,
      ),
    );
  });

  return { refused, strange };
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
 * other than a string is one the derivation cannot walk. A condition carrying
 * all three as strings can still hold a `value` no canonical text covers, which
 * is what `nameable` asks of the rules whose conditions this walk read.
 *
 * Those condition shape issues reach both callers, and `arrayIsOrder` does not
 * separate them. `createFeatures` takes the `any` `JSON.parse` returns through
 * its inferring overload, which
 * `docs/superpowers/plans/2026-09-29-feature-config-distribution.md` names as a
 * real path and Task 8 documents, so a control plane's body reaches a store
 * through it. Each of the four defects raises out of `resolve`: `evaluate.ts:53`
 * iterates `rule.when`, `rule-id.ts:48` reads `condition.zone.length`, and
 * `conditionText` length-prefixes `field` and `op` the same way, so
 * `errors.ts:3-11` has the raise happen where the configuration is supplied. A
 * TypeScript literal satisfies all four by type, so the author's path meets none
 * of them. Either way the rule id walk skips a rule whose conditions it cannot
 * name.
 *
 * `served` separates the callers for the member walks, which refuse a member no
 * shape below a definition names. Nothing raises on one: a holder reads the
 * members its own types declare and evaluates the rest as absent, which is the
 * § 3 defect a document carries and the literal path's compiler already answers.
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

  const definitionRows: readonly unknown[] = definitions;
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
      const elements: readonly unknown[] = declared;
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

    for (const member of ['variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (!shapes[member] || !Array.isArray(value)) continue;
      const elements: readonly unknown[] = value;
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
          all.push(...strangeMembers(element, RULE, 'rule', named, path, key));
          const rollout: unknown = element['rollout'];
          if (isRecord(rollout)) {
            all.push(
              ...strangeMembers(
                rollout,
                ROLLOUT,
                'rollout',
                named,
                `${path}/rollout`,
                key,
              ),
            );
          }
        }
        const inner = conditionIssues(element, named, path, key);
        all.push(...inner.refused);
        if (served) all.push(...inner.strange);
        if (inner.refused.length > 0) {
          unwalked.add(element);
        } else if (id === undefined && !nameable(element as unknown as Rule)) {
          // A rule this walk cannot name is a rule no caller can evaluate, so it
          // is reported here rather than dropped. `ruleIdErrors` skips it after
          // this, the way it skips a rule whose `when` the walk refused.
          unwalked.add(element);
          all.push(unnameable(element, named, path, key));
        }
        // A rule whose id is not a string is one `ruleIdErrors` would key its
        // map on, so it is the one rule the id walk drops.
        if (readableId) read.rules.push(element);
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
      ...(every.rules ? {} : { someRules: read.rules as readonly Rule[] }),
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
 * The rule-level sentence is the fallback, for a rule whose conditions each name
 * on their own. `rolloutText` canonicalises `{ by, seed }`, so a `by` that holds
 * itself raises where no condition does.
 */
function unnameable(
  rule: Readonly<Record<string, unknown>>,
  named: string,
  at: string,
  key?: FeatureKey,
): Found {
  const when: unknown = rule['when'];
  const conditions: readonly unknown[] = Array.isArray(when) ? when : [];
  for (let inside = 0; inside < conditions.length; inside += 1) {
    const condition: unknown = conditions[inside];
    if (nameable({ when: [condition] } as unknown as Rule)) continue;
    const path = `${at}/when/${String(inside)}/value`;
    const op: unknown = isRecord(condition) ? condition['op'] : undefined;
    if (op === 'before' || op === 'after') {
      return found(
        'invalid-instant',
        new FeatureConfigError(
          `${named} declares the instant at ${path} as a value this checker cannot read as a point in time, and the derivation a decision reads this rule's id from raises on it`,
        ),
        key,
        path,
      );
    }
    return unreadable(
      `${named} declares the value at ${path} as one no canonical text names, and the derivation a decision reads this rule's id from raises on it`,
      path,
      key,
    );
  }
  return unreadable(
    `${named} declares a rule at ${at} whose conditions carry a value no canonical text names, and the derivation a decision reads this rule's id from raises on it`,
    `${at}/when`,
    key,
  );
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
  const all: Found[] = [...issues];

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
