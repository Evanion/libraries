import { graphErrors } from './graph.js';
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
import type { FeatureDefinition, FeatureKey } from './types.js';

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
  /** The dependencies, when every element arrived as a key. */
  readonly dependsOn?: readonly FeatureKey[];
  /** Whether the variant walk reads this definition. */
  readonly variants: boolean;
  /** Whether `rules` arrived as an array of rule objects. */
  readonly rules: boolean;
}

/** Nothing the walks after it can read, for a definition that is not an object. */
const UNREADABLE: Readable = { variants: false, rules: false };

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
 * `key` is read here and not only named in a message. Every other check hangs
 * off it: `graphErrors` dedupes on it, `resolveAll` writes it as a property of
 * the `Decisions` record, and `definitionOf` looks a definition up by it. A
 * document declaring two features keyed `{}` passes every other check and builds
 * a store where `Object.fromEntries` writes both to `"[object Object]"`, so the
 * second one answers for the first and nothing reports it.
 *
 * A rule's `when` is not checked here, because nothing between `JSON.parse` and
 * this checker reads a condition. `documentRule` in `serialize.ts` states that
 * from the serializer's side.
 */
function shapeWalk(config: Checkable): {
  readonly issues: readonly Found[];
  readonly rows: readonly Readable[];
} {
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
      elements.forEach((element, inside) => {
        if (isKey(element)) return;
        shapes.dependsOn = false;
        all.push(
          unreadable(
            `${named} declares the dependency at ${pointer(at, 'dependsOn')}/${String(inside)} as ${met(element)}, and this checker reads a key`,
            `${pointer(at, 'dependsOn')}/${String(inside)}`,
            key,
          ),
        );
      });
      // Every element answered `isKey` above.
      if (shapes.dependsOn) dependsOn = elements as readonly FeatureKey[];
    }

    for (const member of ['variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (!shapes[member] || !Array.isArray(value)) continue;
      const elements: readonly unknown[] = value;
      elements.forEach((element, inside) => {
        if (isRecord(element)) return;
        const path = `${pointer(at, member)}/${String(inside)}`;
        shapes[member] = false;
        all.push(
          unreadable(
            `${named} declares the ${ELEMENTS[member]} at ${path} as ${met(element)}, and this checker reads an object`,
            path,
            key,
          ),
        );
      });
    }

    rows.push({
      ...(key === undefined ? {} : { key }),
      ...(dependsOn === undefined ? {} : { dependsOn }),
      variants: shapes.variants,
      rules: shapes.rules,
    });
  });

  return { issues: all, rows };
}

/** Two rules of one feature declaring one id. */
function ruleIdErrors(
  definition: FeatureDefinition<FeatureKey>,
): readonly FeatureConfigError[] {
  const seen = new Set<string>();
  const errors: FeatureConfigError[] = [];
  for (const rule of definition.rules ?? []) {
    if (rule.id === undefined) continue;
    if (seen.has(rule.id)) {
      errors.push(
        new FeatureConfigError(
          `feature "${String(definition.key)}" declares the rule id "${rule.id}" twice`,
        ),
      );
      continue;
    }
    seen.add(rule.id);
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
  const { issues, rows } = shapeWalk(config);
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

    // `variantErrors` reads `variants` and every `rule.variant`, so it runs
    // only where the checker read both arrays.
    if (row.variants && row.rules) {
      for (const defect of variantErrors(definition, options)) {
        all.push(
          found(defect.code, defect.error, row.key, pointer(at, defect.member)),
        );
      }
    }

    if (!row.rules) return;
    for (const error of ruleIdErrors(definition)) {
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
