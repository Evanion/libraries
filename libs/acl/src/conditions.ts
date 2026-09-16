import type {
  Condition,
  ConditionOutcome,
  EvaluationContext,
  Instant,
} from './types.js';

function toEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * Reads a namespaced path ("subject.id", "object.authorId") or the bare "now"
 * from a context, with a hasOwnProperty guard so prototype-chain fields never
 * resolve. Returns undefined when the scope or field is absent.
 */
function readPath(ctx: EvaluationContext, path: string): unknown {
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

function held(value: boolean): ConditionOutcome {
  return value ? HOLDS : FAILS;
}

/**
 * Whether one operand's absence leaves the condition undecidable.
 *
 * The `object` scope is a projection the caller chose: a partial instance and no
 * instance are the same shortfall, so an absent `object.*` path is undecidable.
 * The subject is resolved whole by the app and is never a projection, so an
 * absent `subject.*` path is a definite miss.
 */
function isObjectPath(path: string): boolean {
  return path.startsWith('object.');
}

/**
 * How a condition stands against a context. Never throws.
 *
 * Absence is undecidable for every operator, negative ones included: `ne` over
 * a path that does not read is not "true because it is not equal".
 */
export function evaluateCondition(
  condition: Condition,
  ctx: EvaluationContext,
): ConditionOutcome {
  if (condition.op === 'before' || condition.op === 'after') {
    const now = ctx.now;
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return FAILS;
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return FAILS;
    return held(
      condition.op === 'before'
        ? now.getTime() < boundary
        : now.getTime() > boundary,
    );
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

  if (missing.length > 0) return { state: 'undecidable', missing };

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
