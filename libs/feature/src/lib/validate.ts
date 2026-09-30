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
 * window carries a `Date`. The graph and the variants read `key`, `dependsOn`,
 * `variants` and `rule.variant`, which the two forms declare alike, so the
 * wider element type is what admits both callers.
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

/** The key an issue names, for a definition whose key a document chose. */
function keyOf(
  definition: Readonly<Record<string, unknown>>,
): FeatureKey | undefined {
  const key: unknown = definition['key'];
  if (typeof key === 'string' || typeof key === 'number') return key;
  return undefined;
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
 * Every member a candidate document carries as something the checker cannot
 * read.
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
 * `collectIssues` reports these alone and walks nothing else, which is the rest
 * of § 3: a holder refuses the whole document, drops nothing, and evaluates
 * nothing. A walk over a member that is the wrong shape reports defects that
 * describe nothing in the document. `"dependsOn": "ab"` is iterable, so the walk
 * reads the two characters as two dependencies and an operator reads a cycle
 * that no row declares.
 *
 * A rule's `when` is not checked here, because nothing between `JSON.parse` and
 * this checker reads a condition. `documentRule` in `serialize.ts` states that
 * from the serializer's side.
 */
function shapeIssues(config: Checkable): readonly Found[] {
  const definitions: unknown = config.features;
  if (!Array.isArray(definitions)) {
    return [
      unreadable(
        `the document declares "features" as ${met(definitions)}, and this checker reads an array of definitions`,
        '/features',
      ),
    ];
  }

  const rows: readonly unknown[] = definitions;
  const all: Found[] = [];
  rows.forEach((definition, at) => {
    if (!isRecord(definition)) {
      all.push(
        unreadable(
          `the definition at /features/${String(at)} is ${met(definition)}, and this checker reads an object`,
          pointer(at),
        ),
      );
      return;
    }

    const key = keyOf(definition);
    const named =
      key === undefined
        ? `the definition at /features/${String(at)}`
        : `feature "${String(key)}"`;

    for (const member of ['dependsOn', 'variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (value === undefined || Array.isArray(value)) continue;
      all.push(
        unreadable(
          `${named} declares "${member}" as ${met(value)}, and this checker reads ${MEMBERS[member]}`,
          pointer(at, member),
          key,
        ),
      );
    }

    for (const member of ['variants', 'rules'] as const) {
      const value: unknown = definition[member];
      if (!Array.isArray(value)) continue;
      const elements: readonly unknown[] = value;
      elements.forEach((element, inside) => {
        if (isRecord(element)) return;
        all.push(
          unreadable(
            `${named} declares the ${ELEMENTS[member]} at ${pointer(at, member)}/${String(inside)} as ${met(element)}, and this checker reads an object`,
            `${pointer(at, member)}/${String(inside)}`,
            key,
          ),
        );
      });
    }
  });

  return all;
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
 * A member the checker cannot read ends the walk. § 3 refuses the whole document
 * there and evaluates nothing, and a walk over a member that is the wrong shape
 * reports defects that describe no row an operator can fix.
 *
 * Then the graph, because a duplicate key and an unknown dependency describe the
 * document as a whole. Then each definition in document order, with its variants
 * and its rule ids.
 *
 * Not exported from the package. `validateConfig` is the public half and
 * `createFeatures` is the other caller.
 */
export function collectIssues(
  config: Checkable,
  options: VariantCheckOptions = {},
): readonly Found[] {
  const unread = shapeIssues(config);
  if (unread.length > 0) return unread;

  const definitions = config.features;
  const all: Found[] = graphErrors(definitions).map((error) =>
    found(
      graphCode(error),
      error,
      error instanceof DuplicateFeatureError ||
        error instanceof UnknownDependencyError
        ? error.key
        : undefined,
    ),
  );

  definitions.forEach((definition, at) => {
    for (const defect of variantErrors(definition, options)) {
      all.push(
        found(
          defect.code,
          defect.error,
          definition.key,
          pointer(at, defect.member),
        ),
      );
    }
    for (const error of ruleIdErrors(definition)) {
      all.push(
        found('duplicate-rule-id', error, definition.key, pointer(at, 'rules')),
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
 * every variant in it declares an `order` or the document is refused. § 3 states
 * why: a holder that fills that gap with the array index
 * computes a different assignment from a holder whose copy of the array a
 * serializer permuted, and neither one reports anything. `createFeatures` reads
 * the literal an author wrote, where the array is the order, and takes the index.
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
