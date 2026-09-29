import { FeatureConfigError } from './errors.js';
import { instantEpoch } from './instant.js';
import type {
  Condition,
  EvaluationContext,
  FeatureDefinition,
  FeatureKey,
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
 * Checks a feature's window conditions at construction, beside the variant and
 * dependency checks.
 *
 * A window whose string names no instant has no answer evaluation can give.
 * ECMA-262 reads a date-time carrying no offset as local time, so the boundary
 * sits at a different moment in every zone, while `ruleId` derives one name for
 * the rule on every host.
 * `docs/specs/2026-09-23-feature-variants.md`, "Determinism across processes",
 * requires one answer per subject per moment in every process, so the string is
 * refused where the configuration is supplied.
 *
 * @throws {FeatureConfigError} when a `before` or `after` condition names a
 * string that no host resolves, or that hosts resolve differently.
 */
export function validateConditions<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  for (const rule of definition.rules ?? []) {
    for (const condition of rule.when ?? []) {
      if (condition.op !== 'before' && condition.op !== 'after') continue;
      if (typeof condition.value !== 'string') continue;
      if (!Number.isNaN(instantEpoch(condition.value))) continue;

      throw new FeatureConfigError(
        `feature "${String(definition.key)}" has a rule whose "${condition.op}" condition names the instant "${condition.value}", which names no instant. Write an ISO 8601 date, or a date-time carrying "Z" or an explicit offset: a date-time without one is read as local time and resolves differently on every host.`,
      );
    }
  }
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
    const boundary = instantEpoch(condition.value);
    if (Number.isNaN(boundary)) return false;
    return condition.op === 'before'
      ? now.getTime() < boundary
      : now.getTime() > boundary;
  }

  // `in` walks the prototype chain, so a condition over `constructor` or
  // `toString` reads a function off `Object.prototype` and evaluates against
  // it, which makes `ne` hold on a field the context does not carry. A context
  // is caller data, and a field name is config.
  if (!Object.prototype.hasOwnProperty.call(context, condition.field))
    return false;
  const actual = context[condition.field];
  if (actual === undefined) return false;

  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'ne':
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
