import { graphErrors } from './graph.js';
import { variantErrors } from './variants.js';
import {
  DuplicateFeatureError,
  DuplicateVariantError,
  FeatureConfigError,
  FeatureCycleError,
  UnknownDependencyError,
  UnknownVariantError,
} from './errors.js';
import type {
  ConfigIssue,
  ConfigIssueCode,
  FeatureConfig,
  ValidationResult,
} from './config.js';
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

/**
 * The code a variant error reports as.
 *
 * `variantErrors` raises a bare `FeatureConfigError` for five distinct defects,
 * so the text it wrote is the only thing that separates them. The spec names 18
 * codes and none of them covers a partial `order` declaration or a weight total
 * that is not finite, so the first maps to `invalid-variant-order` and the
 * second to `zero-weights`, which are the codes closest to what an operator has
 * to fix.
 */
function variantCode(error: FeatureConfigError): ConfigIssueCode {
  if (error instanceof DuplicateVariantError) return 'duplicate-variant';
  if (error instanceof UnknownVariantError) return 'unknown-variant';
  if (error.message.includes('empty variants array')) return 'empty-variants';
  if (error.message.includes('which is not a usable share'))
    return 'invalid-weight';
  if (error.message.includes('non-negative integer'))
    return 'invalid-variant-order';
  if (error.message.includes('two variants the order'))
    return 'duplicate-variant-order';
  if (error.message.includes('mixes two orderings'))
    return 'invalid-variant-order';
  return 'zero-weights';
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

/** The member a variant error points at, so a UI highlights the right row. */
function variantMember(error: FeatureConfigError): string {
  if (error instanceof UnknownVariantError) return 'rules';
  return 'variants';
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
 * The graph comes first, because a duplicate key and an unknown dependency
 * describe the document as a whole. Then each definition in document order,
 * with its variants and its rule ids.
 *
 * Not exported from the package. `validateConfig` is the public half and
 * `createFeatures` is the other caller.
 */
export function collectIssues(config: Checkable): readonly Found[] {
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
    for (const error of variantErrors(definition)) {
      all.push(
        found(
          variantCode(error),
          error,
          definition.key,
          pointer(at, variantMember(error)),
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
