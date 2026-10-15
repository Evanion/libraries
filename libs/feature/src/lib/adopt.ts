import { reportDivergence } from './divergence.js';
import type { DivergenceObserver } from './divergence.js';
import type { DecisionSet } from './decision-set.js';
import { ruleFields } from './evaluate.js';
import type { Features } from './features.js';
import type { DeepReadonly } from './observe.js';
import { ruleId } from './rule-id.js';
import type {
  Decision,
  Decisions,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
  Schema,
  VariantInfo,
} from './types.js';
import { assignVariant } from './variants.js';
import type { VariantAssignment } from './variants.js';

/** What a consumer does when the shipped version is not the store's. */
export type VersionMismatchPolicy = 'use-shipped' | 're-resolve';

/** What a caller passes `adoptDecisions` beyond the set itself. */
export interface AdoptOptions<F extends FeatureKey = string> {
  /**
   * The evaluation context this process holds. A `'render'` set's instant is
   * the default for `now` where the context states none.
   */
  context?: EvaluationContext;
  /** What to do about a version mismatch. Defaults to `'use-shipped'`. */
  onVersionMismatch?: VersionMismatchPolicy;
  /** Notified for every divergence. Alters no decision. */
  onDivergence?: DivergenceObserver<F>;
  /**
   * Whether to resolve locally and report every decision that differs.
   *
   * A second resolution costs a `'resolve'` event on a store built with
   * `observe`, so a caller states the answer and this function reads no host
   * global to guess it. `@evanion/react-feature` passes the development read.
   */
  compare?: boolean;
}

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
 * clock is inside, and under `'re-resolve'` `adoptDecisions` publishes it.
 */
function instantOf(now: string): Date {
  const stated = new Date(now);
  return Number.isNaN(stated.getTime()) ? new Date() : stated;
}

/**
 * A decision record at the erased key type.
 *
 * Both forms of `Decisions<S>` hold one decision per key, and every field this
 * module reads sits in output position.
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
 * `adoptDecisions` reads it and nothing else does.
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
        'these decisions and this store cannot be compared: one of the two carries no config version, so this process cannot tell whether the two processes hold one configuration. Serve the document with a version and hand serializeConfig its envelope.',
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
 * Whether a context carries a value at `field`.
 *
 * A bare index walks the prototype chain, so a rule or a bucketing field named
 * `constructor` reads a function off `Object.prototype`. `evaluateCondition`
 * guards the same read the same way (`conditions.ts:160-165`), and a context
 * is caller data while a field name is config.
 */
function carries(context: EvaluationContext, field: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(context, field) &&
    context[field] !== undefined
  );
}

/**
 * Names a pinned assignment whose rule this process's context cannot read.
 *
 * A `'pinned'` assignment states the variant a rule's own `variant` member
 * named, which the engine writes over whatever `assignVariant` answered
 * (`evaluate.ts:240-252`). The value at `assignment.by` decided nothing, so
 * naming that field would ask the developer for a value that changes no
 * answer. The rule decided, and the fields its conditions and its rollout read
 * are what this process has to carry to reach the same pin.
 *
 * It names the fields the context carries nothing at and nothing else. A
 * context carrying every one of them reads the rule the way the server read
 * it, and the two then differ only where the two configurations differ, which
 * is what the version check and the comparison answer. Decision 7 is
 * what the report follows: the client could not have reproduced a pin off a
 * rule it cannot evaluate, and § 4 runs this check on every adoption,
 * including the ones that compare nothing.
 *
 * `now` is never named. Every entry point fills it from the clock for a
 * context carrying none (`features.ts:911`), so a rule reading a date window
 * is readable here whatever the context holds.
 *
 * A pinned assignment naming no rule, or naming one this store does not hold,
 * reports nothing. The wire carries whatever a producer sent, and no rule here
 * states what that one matched on. The version check names two stores that
 * disagree about the rules.
 *
 * `local` is the caller's `assignVariant` answer for the same definition and
 * context. A store answering nothing there assigns no variant for the key at
 * all, which {@link sufficiency} reports before it reaches this check, so the
 * message always names the variant a client resolution would reach.
 */
function pinSufficiency<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  decision: AnyDecision,
  local: VariantAssignment,
  context: EvaluationContext,
  observer: DivergenceObserver<FeatureKey> | undefined,
): void {
  const named = decision.assignment?.rule;
  const pinning = (definition.rules ?? []).find(
    (rule) => ruleId(rule) === named,
  );
  if (!pinning) return;

  const unreadable = ruleFields(pinning).filter(
    (field) => field !== 'now' && !carries(context, field),
  );
  const [first] = unreadable;
  if (first === undefined) return;

  reportDivergence(observer, {
    kind: 'missing-field',
    key: decision.key,
    field: first,
    shipped: { variant: decision.variant, source: 'pinned' },
    local: { variant: local.variant.name, source: local.source },
    message: `feature "${String(decision.key)}": the server assigned variant "${String(decision.variant)}" off rule "${String(named)}", and this process's context carries no ${unreadable.map((field) => `"${field}"`).join(', ')}, so that rule cannot match here and a client resolution would assign "${local.variant.name}" (source: ${local.source}). Pass ${unreadable.join(', ')} to the context this process adopts with.`,
  });
}

/**
 * Names every shipped decision this process's context could not reproduce.
 *
 * It skips a decision whose own source is `'fallback'`, because that decision
 * states the server could not bucket either and the two processes agree.
 *
 * The local side is `assignVariant` over this process's own context, which is
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
 *
 * `field` names the field this process needs and not the one the server used.
 * The two are the same field for two processes holding one configuration, and
 * they differ where the client store's `variantBy` names another field and
 * where the assignment was `'sticky'` and the client carries no sticky map.
 * Naming the server's field for those tells the developer to supply a value
 * the engine here never reads.
 *
 * The message states which of the two the context did: a field it carries
 * nothing at, or a field it carries a value at that `assignVariant` cannot
 * bucket -- `null`, an object, a boolean.
 *
 * A store that assigns no variant for the shipped key at all carries no
 * `field` and names neither of those two. It declares no such feature, or it
 * declares the feature with no variants; either way no context reproduces the
 * assignment, and a report naming the server's bucketing field would send the
 * developer after a value no engine here reads. The fix is the document this
 * store was built from.
 *
 * A `'pinned'` assignment goes to {@link pinSufficiency}, which reads the
 * rule's fields instead of the bucketing field.
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

    const key = String(decision.key);
    const definition = features.definition(
      decision.key as keyof S & FeatureKey,
    );
    const shippedSide = {
      variant: decision.variant,
      source: assignment.source,
    };

    // A server one version ahead ships a decision for a feature this store
    // does not declare. There is no local assignment to compute, and the
    // shipped one is still an answer this process cannot reproduce.
    if (!definition) {
      reportDivergence(observer, {
        kind: 'missing-field',
        key: decision.key,
        shipped: shippedSide,
        message: `feature "${key}": the server shipped variant "${String(decision.variant)}" for it, and this store declares no feature "${key}", so this process assigns no variant for it whatever its context carries. Reload the store from the document the server resolved against.`,
      });
      continue;
    }

    // The store gap is read before the source is, because a pin answers off
    // this store's variants too. `decide` assigns a matching rule's own
    // `variant` over what `assignVariant` answered, and it returns the
    // decision with no variant at all where that call answered nothing
    // (`evaluate.ts:236-237`), so a store declaring the key with no variants
    // reproduces no pin either. § 4 names this check as the only one that can
    // report a pin, and it runs whether or not the caller compares, so routing
    // a pin past this branch would leave the gap unnamed wherever nothing
    // compares.
    const local = assignVariant(definition, context);
    if (!local) {
      reportDivergence(observer, {
        kind: 'missing-field',
        key: decision.key,
        shipped: shippedSide,
        message: `feature "${key}": the server assigned variant "${String(decision.variant)}" for it, and this store declares feature "${key}" with no variants, so this process assigns no variant for it whatever its context carries. Reload the store from the document the server resolved against.`,
      });
      continue;
    }

    if (assignment.source === 'pinned') {
      pinSufficiency(definition, decision, local, context, observer);
      continue;
    }

    if (local.source !== 'fallback') continue;

    const served = `feature "${key}": the server assigned variant "${String(decision.variant)}" by "${assignment.by}"`;

    const by = local.by;
    const control = local.variant.name;
    const lacking = carries(context, by)
      ? `carries no value at "${by}" that buckets a subject, so a client resolution would assign "${control}" (source: fallback). Pass a string or a number at ${by}`
      : `carries no "${by}", so a client resolution would assign "${control}" (source: fallback). Pass ${by}`;

    reportDivergence(observer, {
      kind: 'missing-field',
      key: decision.key,
      field: by,
      shipped: shippedSide,
      local: { variant: control, source: 'fallback' },
      message: `${served}, and this process's context ${lacking} to the context this process adopts with.`,
    });
  }
}

/**
 * Names every key whose local answer differs from the shipped one.
 *
 * The `hasOwnProperty` guard is what keeps a shipped set keyed `constructor`
 * from reading a function off `Object.prototype` and comparing a decision
 * against it. `assignVariant` and `resolvePlan` guard the same read the same
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
      message: `feature "${String(sent.key)}": the shipped decision is ${sent.enabled ? 'on' : 'off'} (${sent.reason})${sent.variant === undefined ? '' : ` as "${sent.variant}"`} and this process resolves ${here.enabled ? 'on' : 'off'} (${here.reason})${here.variant === undefined ? '' : ` as "${here.variant}"`}. A view rendered from the local decision differs from the one the server rendered, and nothing else names the cause.`,
    });
  }
}

/**
 * The decisions a process publishes from a set another process resolved, with
 * every divergence reported before the caller reads one.
 *
 * A mismatch publishes the shipped set. The server already rendered from it
 * and recorded an exposure for the variant it shipped, so a consumer that
 * quietly resolves a third answer makes every experiment result wrong by an
 * amount nobody can measure from the data. The consumer also cannot tell which
 * side is stale: a mismatch says the two envelopes differ, and the consumer's
 * copy is the older one as often as the newer.
 */
export function adoptDecisions<
  S extends Record<keyof S, VariantInfo | never> = Schema,
>(
  features: Features<S>,
  shipped: DecisionSet<S> | undefined,
  options?: AdoptOptions<keyof S & FeatureKey>,
): Decisions<S> | DeepReadonly<Decisions<S>> {
  const context = options?.context;
  const observer = options?.onDivergence as
    DivergenceObserver<FeatureKey> | undefined;

  if (!shipped) return features.resolve(context);

  // A set from a per-request render carries an instant seconds old, and it is
  // the default for everything this process resolves locally. A set from a
  // build carries one that may be days old, so this process's own clock
  // answers.
  const settled: EvaluationContext =
    shipped.origin === 'render'
      ? { ...context, now: context?.now ?? instantOf(shipped.now) }
      : { ...context };

  const sent = erasedSet(shipped.decisions);
  const diverged = compared(shipped.version, features.version, observer);

  sufficiency(features, settled, sent, observer);

  // One local resolution at most, and only when something reads it. The
  // comparison reads it, and so does a `'re-resolve'` caller whose two
  // versions differ.
  //
  // `'re-resolve'` answers a version mismatch. An `'unversioned'` outcome
  // proves nothing about the two configurations, and a caller that discarded
  // the shipped set over it would discard it on every adoption over a literal
  // store, which is the hydration divergence the spec's § 4 is about.
  //
  // `diff` is the only reader of a comparing resolution and
  // `reportDivergence` returns on its first line for an observer that is not
  // there (`divergence.ts:62`), so a call made without `onDivergence` would
  // resolve for nobody. That resolution is not free: a store built with
  // `observe` emits a `'resolve'` event for it (`features.ts:1298-1308`), and
  // the event names decisions this process never publishes, so an exposure
  // pipeline reading those events would record one subject twice under two
  // variants.
  //
  // The caller decides `compare`, because the core reads no host global and
  // only the caller knows whether its bundle is a development one.
  const reResolve =
    diverged === 'config-version' &&
    (options?.onVersionMismatch ?? 'use-shipped') === 're-resolve';
  const comparing = observer !== undefined && options?.compare === true;
  const local = reResolve || comparing ? features.resolve(settled) : undefined;

  if (comparing && local) diff(sent, erasedSet(local), observer);
  if (reResolve && local) return local;

  return shipped.decisions as Decisions<S> | DeepReadonly<Decisions<S>>;
}
