import type {
  Condition,
  EvaluationContext,
  Instant,
  Weekday,
} from './types.js';

const WEEKDAYS: readonly Weekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

function toEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * The weekday `instant` falls on in `zone`.
 *
 * Derived through `Intl`, not through an offset calculation: the zone's rules,
 * including its DST transitions, are the runtime's to know and not this
 * library's to model.
 */
function weekdayIn(instant: Date, zone: string): Weekday | undefined {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
  })
    .format(instant)
    .toLowerCase();

  return WEEKDAYS.find((day) => day === formatted);
}

/**
 * The context fields a condition reads. Used by `plan()` to decide what it can
 * resolve at build time and what it has to defer.
 */
export function conditionFields(condition: Condition): readonly string[] {
  return [condition.field];
}

/**
 * Whether a condition holds for a context.
 *
 * A condition over a field the context does not carry never holds -- including
 * the negative operators. `ne` on an absent field is not "true because it is not
 * equal"; it is unevaluable, and treating it as true would switch features on
 * for exactly the contexts that carry the least information.
 */
export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext,
): boolean {
  if (condition.op === 'day-of-week') {
    const now = context.now;
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
    const day = weekdayIn(now, condition.zone);
    return day !== undefined && condition.value.includes(day);
  }

  if (condition.op === 'before' || condition.op === 'after') {
    const now = context.now;
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return false;
    return condition.op === 'before'
      ? now.getTime() < boundary
      : now.getTime() > boundary;
  }

  if (!(condition.field in context)) return false;
  const actual = context[condition.field];
  if (actual === undefined) return false;

  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'ne':
      return actual !== condition.value;
    case 'in':
      return (
        Array.isArray(condition.value) && condition.value.includes(actual)
      );
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
