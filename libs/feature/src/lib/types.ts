/**
 * A feature identifier. Carried over from the 2022 sketch, which parameterised
 * on `Feature extends string | number` so a consumer can use a string union or
 * a numeric enum and keep exhaustiveness.
 */
export type FeatureKey = string | number;

/** Weekday names, in the IANA zone a day-of-week condition names. */
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

/**
 * A point in time a window condition compares against. A string is parsed as
 * ISO 8601, a number as epoch milliseconds.
 */
export type Instant = string | number | Date;

/** `now` is before / after a fixed instant. */
export interface WindowCondition {
  field: 'now';
  op: 'before' | 'after';
  value: Instant;
}

/**
 * `now` falls on one of these weekdays, in an explicit IANA zone.
 *
 * The zone is required, not defaulted: UTC day-of-week is wrong for every
 * business rule anyone writes.
 */
export interface DayOfWeekCondition {
  field: 'now';
  op: 'day-of-week';
  zone: string;
  value: readonly Weekday[];
}

/** A context attribute compared against a literal. */
export interface AttributeCondition {
  field: string;
  op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains';
  value: unknown;
}

export type Condition =
  | WindowCondition
  | DayOfWeekCondition
  | AttributeCondition;

/**
 * A percentage rollout.
 *
 * `by` names the context field to bucket on, defaulting to `targetingKey`.
 * `seed` overrides the bucketing seed, which otherwise is the feature key --
 * the defaulting that decorrelates a user's bucket across features. Override it
 * only to deliberately correlate two features, e.g. to keep a pair of flags
 * rolling out to the same cohort.
 */
export interface RolloutSpec {
  percent: number;
  by?: string;
  seed?: string;
}

/**
 * One activation rule. Matches when every `when` condition holds AND, if a
 * `rollout` is present, the bucketed value falls inside it.
 */
export interface Rule {
  /** Used in `reason`. Defaults to the rule's index, as `#0`, `#1`, ... */
  id?: string;
  when?: readonly Condition[];
  rollout?: RolloutSpec;
}

/**
 * Stored intent for one feature. This is configuration: evaluation never writes
 * to it.
 */
export interface FeatureDefinition<F extends FeatureKey = string> {
  key: F;
  /**
   * The maintainer wants this on. `false` short-circuits -- rules never run.
   * `true` hands the decision to the rules, and no rules means on.
   *
   * It is a kill switch in one direction only: turning it on for a feature
   * whose rules do not match changes intent and the feature still resolves off.
   */
  enabled: boolean;
  /**
   * Features that must resolve on for this one to resolve on. Cascades
   * transitively and one way only -- a dependant never blocks its parent.
   */
  dependsOn?: readonly F[];
  /** OR-ed. No rules means on (given `enabled`). */
  rules?: readonly Rule[];
  /** Bucketing seed for every rollout in this feature. Defaults to the key. */
  seed?: string;
  /**
   * Opt in to resolving `now`-dependent rules during `plan()`, freezing the
   * window at build time. Off by default: whether a date window may be frozen
   * into a build is a deploy-cadence decision and belongs to whoever owns the
   * feature.
   */
  freezeTimeAtBuild?: boolean;
}

/**
 * Evaluation context. `now` is injected rather than read from an ambient clock,
 * defaulting to `new Date()` at the call.
 */
export interface EvaluationContext {
  now?: Date;
  /** The default rollout bucketing field. */
  targetingKey?: string;
  [field: string]: unknown;
}

export type Reason =
  /** Enabled, no rules. */
  | 'default-on'
  /** Enabled, a rule matched. Carries the rule id. */
  | 'rule-match'
  /** `enabled === false`. */
  | 'explicitly-off'
  /** Enabled, rules present, none passed. Carries the per-rule breakdown. */
  | 'no-rule-matched'
  /** A parent resolved off. Carries the blocking edge and the root cause. */
  | 'dependency-off';

/** Why one rule did not match. */
export interface RuleOutcome {
  rule: string;
  matched: boolean;
  /** The first condition that failed, so a UI can name it. */
  failed?: Condition;
  /** Present when the rule's rollout was the reason it did not match. */
  rollout?: {
    percent: number;
    by: string;
    /** Absent when the context did not carry the bucketing field. */
    bucket?: number;
    member: boolean;
  };
}

/** The root cause of a cascade: the first ancestor off for a non-dependency reason. */
export interface Cause<F extends FeatureKey = string> {
  key: F;
  reason: Reason;
  rule?: string;
}

/**
 * One feature's decision.
 *
 * `enabled` is the decision. Everything else is explanation, and is output
 * only -- nothing in this library reads `reason`, `rule`, `rules`, `blockedBy`
 * or `cause` back to decide anything.
 */
export interface Decision<F extends FeatureKey = string> {
  key: F;
  enabled: boolean;
  reason: Reason;
  /** The matching rule, on `rule-match`. */
  rule?: string;
  /** Per-rule breakdown, on `no-rule-matched`. */
  rules?: readonly RuleOutcome[];
  /** The immediate parent that blocked this, on `dependency-off`. */
  blockedBy?: F;
  /** The first ancestor off for its own reason, on `dependency-off`. */
  cause?: Cause<F>;
}

export type Decisions<F extends FeatureKey = string> = Record<F, Decision<F>>;

/** One feature's build-time plan. */
export interface PlanEntry<F extends FeatureKey = string> {
  key: F;
  /** `'deferred'` when some rule still needs context this plan did not have. */
  resolved: boolean | 'deferred';
  /** Context fields still needed, sorted. Empty unless `resolved` is deferred. */
  needs: readonly string[];
  /** Present when `resolved` is a boolean: the decision, with its reason. */
  decision?: Decision<F>;
}

export type Plan<F extends FeatureKey = string> = Record<F, PlanEntry<F>>;

export type ToggleResult<F extends FeatureKey = string> =
  | {
      ok: true;
      key: F;
      enabled: boolean;
      /**
       * Dependants that resolve on now and will not after this toggle is
       * applied -- transitive, in dependency order. Empty when enabling.
       */
      willDisable: readonly F[];
    }
  | { ok: false; key: F; error: 'unknown-feature' };
