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
 * A `Date` passes unread. It carries an instant and nothing of the string it
 * was built from, so `new Date('2026-01-01T00:00:00')` has already taken the
 * constructing host's zone before the check sees it, and no reading of the
 * value recovers that. The thrown message names that constructor for the same
 * reason: it is the nearest edit to the string being refused, and it moves the
 * divergence out of reach of every check.
 *
 * @throws {FeatureConfigError} when a `before` or `after` condition names a
 * string outside the ISO 8601 forms ECMA-262 fixes to one instant.
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
        `feature "${String(definition.key)}" has a rule whose "${condition.op}" condition names the instant "${condition.value}", which names no instant. Write an ISO 8601 date with no time, or a date-time carrying "Z" or an offset, in capitals and with no surrounding whitespace: "2026-01-01", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00+01:00", "2026-01-01T00:00:00+0100". Passing the same string to "new Date" does not fix it, because that constructor reads a date-time carrying no offset in the constructing host's zone and a Date reaches this check with no string left to read.`,
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
