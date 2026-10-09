import { reportDivergence } from '../lib/divergence.js';
import { assignVariant } from '../lib/variants.js';
import type { DivergenceObserver } from '../lib/divergence.js';
import type { DecisionSet } from '../lib/decision-set.js';
import type { Features } from '../lib/features.js';
import type { DeepReadonly } from '../lib/observe.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureKey,
  VariantInfo,
} from '../lib/types.js';

/** What a provider does when the shipped version is not the store's. */
export type VersionMismatchPolicy = 'use-shipped' | 're-resolve';

/** One decision at the erased key type. */
type AnyDecision = Decision<FeatureKey>;

/**
 * The instant a set states, or this process's clock where it states none a
 * `Date` reads.
 *
 * `Features.snapshot` refuses to state an instant no `Date` reads
 * (`features.ts:1029-1033`), and a set reaches a client as JSON with nothing
 * re-validating it, so the consuming side absorbs whatever a broken producer
 * sent. `new Date` of an unparsed string answers an invalid `Date`, which
 * `evaluateCondition` reads as `false` for every `before`, `after` and
 * `day-of-week` condition rather than raising (`conditions.ts:144`,
 * `conditions.ts:151`). A resolution at that instant answers a time window no
 * clock is inside, and under `'re-resolve'` the provider publishes it.
 */
function instantOf(now: string): Date {
  const stated = new Date(now);
  return Number.isNaN(stated.getTime()) ? new Date() : stated;
}

/**
 * Whether this bundle is a production one.
 *
 * `process` is a Node global. This package ships as plain ESM with no bundling
 * step and no shim, so a browser loading `@evanion/feature/react` through an
 * import map holds no `process` and reading one raises a `ReferenceError`, and
 * a shim that supplies `process` without `env` raises a `TypeError`. Either
 * one raises out of the provider's `useMemo`, so the whole tree fails to
 * mount over a question about a bundle flag.
 *
 * The member chain is written out whole because a bundler's `define` matches
 * the text `process.env.NODE_ENV` and substitutes the string. A guard that
 * read `process.env` into a local first would defeat that substitution and
 * leave a production bundle running the development diff. `try` keeps the text
 * a bundler replaces and still answers for a runtime that defines neither
 * half; it answers that it cannot prove production, which is the side
 * `createEmitter` takes for the same read (`observe.ts:290-294`).
 */
function production(): boolean {
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

/**
 * A decision record at the erased key type.
 *
 * Both forms of `Decisions<S>` hold one decision per key, and every field this
 * module reads sits in output position. The provider's own `erased` helper
 * makes the same widening for the same reason.
 */
function erasedSet(decisions: unknown): Record<string, AnyDecision> {
  return decisions as Record<string, AnyDecision>;
}

/**
 * What the two sides failed to prove about the configuration they hold,
 * reported through `observer`, and `undefined` where they proved it.
 *
 * `!==` and nothing else. A publisher with no version scheme sets `version` to
 * the digest, which `configDigest` strips before it canonicalises, so this
 * comparison then reads two digests and means the two processes hold one
 * configuration. An ordered comparison would act on an order neither value
 * carries.
 *
 * The kind travels back because `'re-resolve'` answers one of the two kinds.
 * `publishedDecisions` reads it and nothing else does.
 */
function compared(
  shippedVersion: string | number | undefined,
  storeVersion: string | number | undefined,
  observer: DivergenceObserver<FeatureKey> | undefined,
): 'config-version' | 'unversioned' | undefined {
  if (shippedVersion === undefined || storeVersion === undefined) {
    reportDivergence(observer, {
      kind: 'unversioned',
      shipped: { version: shippedVersion },
      local: { version: storeVersion },
      message:
        'these decisions and this store cannot be compared: one of the two carries no config version, so this provider cannot tell whether the two processes hold one configuration. Serve the document with a version and hand serializeConfig its envelope.',
    });
    return 'unversioned';
  }

  if (shippedVersion !== storeVersion) {
    reportDivergence(observer, {
      kind: 'config-version',
      shipped: { version: shippedVersion },
      local: { version: storeVersion },
      message: `these decisions were resolved under config version ${String(shippedVersion)} and this store holds ${String(storeVersion)}, so the two processes hold different configurations. Reload the store from the document the server used, or pass onVersionMismatch: 're-resolve'.`,
    });
    return 'config-version';
  }

  return undefined;
}

/**
 * Names every shipped decision this provider's context could not reproduce.
 *
 * It skips a decision whose own source is `'fallback'`, because that decision
 * states the server could not bucket either and the two processes agree.
 *
 * The local side is `assignVariant` over this provider's own context, which is
 * the call the engine makes for the same decision, so the check answers from
 * the engine's rule rather than from a second reading of it. A bare
 * `context[assignment.by] !== undefined` answers a different question in two
 * ways. `assignVariant` buckets a `string` and a `number` and falls back for
 * every other type (`variants.ts:585-589`), so a context carrying `null` at
 * the bucketing field -- which `EvaluationContext`'s index signature admits --
 * passes a presence test and reproduces nothing. And a `'sticky'` assignment
 * is read off `context.stickyVariants` before the bucketing field is touched
 * at all (`variants.ts:571-583`), so a context carrying the sticky map and no
 * bucketing field reproduces the shipped assignment exactly.
 *
 * It reports wherever the local assignment falls back and the shipped one did
 * not, whatever the two variants are. The report names a context this process
 * cannot bucket with, which holds for the next subject even where the control
 * and the shipped variant coincide for this one.
 */
function sufficiency<S extends Record<keyof S, VariantInfo | never>>(
  features: Features<S>,
  context: EvaluationContext,
  shipped: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  for (const decision of Object.values(shipped)) {
    const assignment = decision.assignment;
    if (!assignment || assignment.source === 'fallback') continue;

    const definition = features.definition(
      decision.key as keyof S & FeatureKey,
    );
    // A server one version ahead ships a decision for a feature this store
    // does not declare. There is no local assignment to compute, and the
    // shipped one is still an answer this provider cannot reproduce.
    const local = definition ? assignVariant(definition, context) : undefined;
    if (local && local.source !== 'fallback') continue;

    const control = local?.variant.name;

    reportDivergence(observer, {
      kind: 'missing-field',
      key: decision.key,
      field: assignment.by,
      shipped: { variant: decision.variant, source: assignment.source },
      local: { variant: control, source: 'fallback' },
      message: `feature "${String(decision.key)}": the server assigned variant "${String(decision.variant)}" by "${assignment.by}", and this provider's context carries no "${assignment.by}", so a client resolution would assign "${String(control)}" (source: fallback). Pass ${assignment.by} to <FeatureProvider context={...}>.`,
    });
  }
}

/**
 * Names every key whose local answer differs from the shipped one.
 *
 * The `hasOwnProperty` guard is what keeps a shipped set keyed `constructor`
 * from reading a function off `Object.prototype` and comparing a decision
 * against it. `useFeature` and `assignVariant` guard the same read the same
 * way.
 */
function diff(
  shipped: Record<string, AnyDecision>,
  local: Record<string, AnyDecision>,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  for (const [key, sent] of Object.entries(shipped)) {
    const here = Object.prototype.hasOwnProperty.call(local, key)
      ? local[key]
      : undefined;
    if (!here) continue;
    if (
      sent.enabled === here.enabled &&
      sent.reason === here.reason &&
      sent.variant === here.variant
    ) {
      continue;
    }

    reportDivergence(observer, {
      kind: 'decision-differs',
      key: sent.key,
      shipped: {
        enabled: sent.enabled,
        variant: sent.variant,
        source: sent.assignment?.source,
      },
      local: {
        enabled: here.enabled,
        variant: here.variant,
        source: here.assignment?.source,
      },
      message: `feature "${String(sent.key)}": the shipped decision is ${sent.enabled ? 'on' : 'off'} (${sent.reason})${sent.variant === undefined ? '' : ` as "${sent.variant}"`} and this provider resolves ${here.enabled ? 'on' : 'off'} (${here.reason})${here.variant === undefined ? '' : ` as "${here.variant}"`}. React reports the DOM difference this causes and names no cause.`,
    });
  }
}

/**
 * The decisions a provider publishes, with every divergence it detects
 * reported before React reconciles.
 *
 * A mismatch renders the shipped set. The server already rendered HTML from it
 * and recorded an exposure for the variant it shipped, so a client that
 * quietly resolves a third answer makes every experiment result wrong by an
 * amount nobody can measure from the data. The provider also cannot tell which
 * side is stale: a mismatch says the two envelopes differ, and the client's
 * copy is the older one as often as the newer.
 */
export function publishedDecisions<
  S extends Record<keyof S, VariantInfo | never>,
>(
  features: Features<S>,
  context: EvaluationContext | undefined,
  shipped: DecisionSet<S> | undefined,
  onVersionMismatch: VersionMismatchPolicy,
  onDivergence: DivergenceObserver<keyof S & FeatureKey> | undefined,
): Decisions<S> | DeepReadonly<Decisions<S>> {
  const observer = onDivergence as DivergenceObserver<FeatureKey> | undefined;

  if (!shipped) return features.resolve(context);

  // A set from a per-request render carries an instant seconds old, and it is
  // the default for everything this provider resolves locally. A set from a
  // build carries one that may be days old, so the client's own clock answers.
  const settled: EvaluationContext =
    shipped.origin === 'render'
      ? { ...context, now: context?.now ?? instantOf(shipped.now) }
      : { ...context };

  const sent = erasedSet(shipped.decisions);
  const diverged = compared(shipped.version, features.version, observer);

  sufficiency(features, settled, sent, observer);

  // One local resolution at most, and only when something reads it. The
  // development diff reads it, and so does a `'re-resolve'` provider whose two
  // versions differ.
  //
  // `'re-resolve'` answers a version mismatch. An `'unversioned'` outcome
  // proves nothing about the two configurations, and a provider that discarded
  // the shipped set over it would discard it on every mount over a literal
  // store, which is the hydration divergence the spec's § 4 is about.
  const reResolve =
    diverged === 'config-version' && onVersionMismatch === 're-resolve';
  const development = !production();
  const local =
    reResolve || development ? features.resolve(settled) : undefined;

  if (development && local) diff(sent, erasedSet(local), observer);
  if (reResolve && local) return local;

  return shipped.decisions as Decisions<S> | DeepReadonly<Decisions<S>>;
}
