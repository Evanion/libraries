import type { Condition, EvaluationContext, Instant } from './types.js';

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

/** Whether a condition holds for a context. Never throws. */
export function evaluateCondition(
  condition: Condition,
  ctx: EvaluationContext,
): boolean {
  if (condition.op === 'before' || condition.op === 'after') {
    const now = ctx.now;
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return false;
    return condition.op === 'before'
      ? now.getTime() < boundary
      : now.getTime() > boundary;
  }

  const actual = readPath(ctx, condition.field);
  // An absent field never holds, including for negative operators: `ne` on an
  // absent field is unevaluable, not "true because it is not equal".
  if (actual === undefined) return false;

  switch (condition.op) {
    case 'eq':
      if (condition.path !== undefined) {
        const other = readPath(ctx, condition.path);
        return other !== undefined && actual === other;
      }
      return actual === condition.value;
    case 'ne':
      if (condition.path !== undefined) {
        const other = readPath(ctx, condition.path);
        return other !== undefined && actual !== other;
      }
      return actual !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'not-in':
      return (
        Array.isArray(condition.value) && !condition.value.includes(actual)
      );
    case 'contains':
      return Array.isArray(actual) && actual.includes(condition.value);
    default:
      return false;
  }
}
