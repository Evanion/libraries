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
 * A context whose clock is settled: `now` is epoch milliseconds, NaN when it is
 * absent or does not parse. The public `EvaluationContext` takes any `Instant`;
 * every entry point settles it once through `resolveContext` so a matrix with
 * many time conditions parses the clock once.
 */
export interface ResolvedContext {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  now: number;
}

/** The epoch a context `now` settles to. NaN when absent or unparseable. */
export function settleNow(now: Instant | null | undefined): number {
  return now === null || now === undefined ? Number.NaN : toEpoch(now);
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
 * compares numbers. A clock that did not settle reads as absent.
 */
function readPath(ctx: ResolvedContext, path: string): unknown {
  if (path === 'now') return Number.isNaN(ctx.now) ? undefined : ctx.now;
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
 * How a condition stands against a settled context. Never throws.
 *
 * Absence is unevaluable for every operator, negative ones included: `ne` over
 * a path that does not read is not "true because it is not equal".
 *
 * A clock or a boundary that does not parse fails the condition. Neither is an
 * `object.*` projection the caller can fill in, so neither is unevaluable.
 */
export function evaluateResolved(
  condition: Condition,
  ctx: ResolvedContext,
): ConditionOutcome {
  if (condition.op === 'before' || condition.op === 'after') {
    const now = ctx.now;
    if (Number.isNaN(now)) return FAILS;
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return FAILS;
    return held(condition.op === 'before' ? now < boundary : now > boundary);
  }

  const missing: string[] = [];

  const actual = readPath(ctx, condition.field);
  if (actual === undefined) {
    if (!isObjectPath(condition.field)) return FAILS;
    missing.push(condition.field);
  }

  // A path comparand is an `eq`/`ne` form only; the other ops compare against a
  // literal `value`.
  const comparandPath =
    condition.op === 'eq' || condition.op === 'ne' ? condition.path : undefined;
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
