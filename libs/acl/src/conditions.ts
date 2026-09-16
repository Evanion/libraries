import type {
  Condition,
  ConditionOutcome,
  EvaluationContext,
  Instant,
} from './types.js';

/**
 * Epoch milliseconds for an instant. NaN for a string that does not parse and
 * for an `Invalid Date`, which every caller reads as "this instant does not
 * decide anything".
 */
export function toEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * A context whose clock is settled: `now` is epoch milliseconds, NaN when the
 * caller supplied an instant that does not parse. The public
 * `EvaluationContext` takes any `Instant`; every entry point settles it once
 * through `resolveContext` so a matrix with many time conditions parses the
 * clock once.
 */
export interface ResolvedContext {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  now: number;
}

/**
 * The epoch a context `now` settles to.
 *
 * An absent clock is the wall clock: not supplying one asks the engine for the
 * current time, and every entry point answers that the same way. A supplied one
 * that does not parse — `null`, `NaN`, an `Invalid Date`, a string that is not a
 * date — settles to NaN, the unusable clock, and no condition reading it
 * decides anything.
 */
export function settleNow(now: Instant | null | undefined): number {
  return now === undefined
    ? Date.now()
    : now === null
      ? Number.NaN
      : toEpoch(now);
}

/** Settles a caller's context into the form the engine evaluates against. */
export function resolveContext(ctx: EvaluationContext): ResolvedContext {
  return {
    subject: ctx.subject,
    object: ctx.object,
    now: settleNow(ctx.now),
  };
}

/**
 * Reads a namespaced path ("subject.id", "object.authorId") or the bare "now"
 * from a context, with a hasOwnProperty guard so prototype-chain fields never
 * resolve. Returns undefined when the scope or field is absent.
 *
 * A bare "now" reads as the settled epoch, so an `eq`-family condition over it
 * compares numbers. `evaluateResolved` settles an unusable clock before any
 * path is read, so the epoch this returns is always a number a comparison can
 * use.
 */
function readPath(ctx: ResolvedContext, path: string): unknown {
  if (path === 'now') return ctx.now;
  const dot = path.indexOf('.');
  if (dot === -1) return undefined;
  const scope = path.slice(0, dot);
  const field = path.slice(dot + 1);
  const bag =
    scope === 'subject'
      ? ctx.subject
      : scope === 'object'
        ? ctx.object
        : undefined;
  if (!bag) return undefined;
  return Object.prototype.hasOwnProperty.call(bag, field)
    ? bag[field]
    : undefined;
}

const HOLDS: ConditionOutcome = { state: 'holds' };
const FAILS: ConditionOutcome = { state: 'fails' };
const UNUSABLE_CLOCK: ConditionOutcome = { state: 'unusable-clock' };

function held(value: boolean): ConditionOutcome {
  return value ? HOLDS : FAILS;
}

/**
 * Whether one operand's absence leaves the condition unevaluable.
 *
 * The `object` scope is a projection the caller chose: a partial instance and no
 * instance are the same shortfall, so an absent `object.*` path is unevaluable.
 * The subject is resolved whole by the app and is never a projection, so an
 * absent `subject.*` path is a definite miss.
 */
function isObjectPath(path: string): boolean {
  return path.startsWith('object.');
}

/**
 * The second path a condition compares against, or undefined when it compares
 * against a literal `value`.
 *
 * `path` is an `eq`/`ne` form, and `validateMatrix` refuses a document that
 * carries one on any other operator, so no constructed policy holds the case
 * this narrows away. Every pass over the operands goes through this, so the
 * comparand rule is stated once and cannot drift between evaluation and
 * inspection.
 */
export function comparandPathOf(condition: Condition): string | undefined {
  return condition.op === 'eq' || condition.op === 'ne'
    ? condition.path
    : undefined;
}

/**
 * Whether a condition reads the `object` scope, on either operand.
 *
 * This is the static question -- what the condition would read given any
 * context -- as against `evaluateResolved`, which answers what one context
 * actually yielded.
 */
export function conditionReadsObject(condition: Condition): boolean {
  if (isObjectPath(condition.field)) return true;
  const comparand = comparandPathOf(condition);
  return comparand !== undefined && isObjectPath(comparand);
}

/** Whether a condition reads the context clock, on either operand. */
function readsClock(condition: Condition): boolean {
  return condition.field === 'now' || comparandPathOf(condition) === 'now';
}

/**
 * How a condition stands against a settled context. Never throws.
 *
 * Absence is unevaluable for every operator, negative ones included: `ne` over
 * a path that does not read is not "true because it is not equal".
 *
 * A clock that does not parse is `unusable-clock`, which is neither a hold nor a
 * fail: a comparison with no instant on one side decides nothing, and a fail
 * here would let a time-gated deny stop denying. The state is terminal for the
 * permission — the caller has to supply an instant that parses — so it is
 * distinct from `unevaluable`, which one refetch repairs.
 *
 * `validateMatrix` refuses a `before`/`after` boundary that does not parse, so a
 * constructed policy reaches the boundary guard only through a condition that
 * did not come from a matrix. It lands in the same state for the same reason.
 */
export function evaluateResolved(
  condition: Condition,
  ctx: ResolvedContext,
): ConditionOutcome {
  if (readsClock(condition) && Number.isNaN(ctx.now)) return UNUSABLE_CLOCK;

  if (condition.op === 'before' || condition.op === 'after') {
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return UNUSABLE_CLOCK;
    return held(
      condition.op === 'before' ? ctx.now < boundary : ctx.now > boundary,
    );
  }

  const missing: string[] = [];

  const actual = readPath(ctx, condition.field);
  if (actual === undefined) {
    if (!isObjectPath(condition.field)) return FAILS;
    missing.push(condition.field);
  }

  const comparandPath = comparandPathOf(condition);
  let other: unknown;
  if (comparandPath !== undefined) {
    other = readPath(ctx, comparandPath);
    if (other === undefined) {
      if (!isObjectPath(comparandPath)) return FAILS;
      missing.push(comparandPath);
    }
  }

  if (missing.length > 0) return { state: 'unevaluable', missing };

  switch (condition.op) {
    case 'eq':
      return held(
        comparandPath !== undefined
          ? actual === other
          : actual === condition.value,
      );
    case 'ne':
      return held(
        comparandPath !== undefined
          ? actual !== other
          : actual !== condition.value,
      );
    case 'in':
      return held(
        Array.isArray(condition.value) && condition.value.includes(actual),
      );
    case 'not-in':
      return held(
        Array.isArray(condition.value) && !condition.value.includes(actual),
      );
    case 'contains':
      return held(Array.isArray(actual) && actual.includes(condition.value));
    default:
      return FAILS;
  }
}

/**
 * How one condition stands against a caller's context. Never throws.
 *
 * This is the single-condition entry point, so it settles the clock itself. The
 * engine settles once per call and uses `evaluateResolved`.
 */
export function evaluateCondition(
  condition: Condition,
  ctx: EvaluationContext,
): ConditionOutcome {
  return evaluateResolved(condition, resolveContext(ctx));
}
