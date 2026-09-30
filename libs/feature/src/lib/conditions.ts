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

/** The largest instant a `Date` holds, ECMA-262 21.4.1.1. */
const RANGE = 8_640_000_000_000_000;

/**
 * Why a window boundary names no instant, and `undefined` when it names one.
 *
 * The three types `Instant` declares fail in three ways and each one reads
 * back differently, so each carries its own sentence into the thrown message.
 *
 * A value outside those three types has no sentence here. A document parsed
 * out of JSON carries `null`, an object, a boolean or an array into a store.
 * What the library owes for one is the answer an unevaluable condition gets on
 * the evaluation path, and this check reads the declared types.
 */
export function windowFault(value: unknown): string | undefined {
  if (typeof value === 'string') {
    if (!Number.isNaN(instantEpoch(value))) return undefined;

    return `names the instant "${value}", which names no instant. Write an ISO 8601 date with no time, or a date-time carrying "Z" or an offset, in capitals, with no surrounding whitespace, and naming a day the month it is written under has: "2026-01-01", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00+01:00", "2026-01-01T00:00:00+0100". Passing the same string to "new Date" does not fix it, because that constructor reads a date-time carrying no offset in the constructing host's zone and a Date reaches this check with no string left to read.`;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value))
      return `carries the number NaN, which names no instant. "Date.parse" answers NaN for a string that named none, so a boundary computed from an unset environment variable or a missing field carries it, and the rule then matches at no moment with nothing in any decision naming the boundary as the reason.`;

    if (Math.abs(value) > RANGE)
      return `carries the epoch milliseconds ${value}, which is outside the range a Date holds, ${-RANGE} to ${RANGE}. A "before" boundary above that range holds at every instant and an "after" boundary at none, so the rule is not a window. The string naming the same moment is refused for the same reason.`;

    return undefined;
  }

  if (value instanceof Date && Number.isNaN(value.getTime()))
    return `carries a Date holding no instant, which is what "new Date" answers for a string naming none. The rule then matches at no moment with nothing in any decision naming the boundary as the reason.`;

  // A value of no type `Instant` declares reaches `evaluateCondition`, which
  // compares against it as `false`. A caller writing a literal has the type to
  // read; `whenIssues` reports it for a document, which carries whatever JSON
  // held.
  return undefined;
}

/**
 * Checks a feature's window conditions at construction, beside the variant and
 * dependency checks.
 *
 * A `before` or `after` boundary has to name an instant a `Date` holds,
 * whichever of the three forms it is written in. A boundary that names none is
 * a rule an operator cannot see the effect of: it either matches at no moment
 * or matches at every one, and no decision carries a reason that points at the
 * boundary.
 *
 * A string carries a second hazard on top of that. ECMA-262 reads a date-time
 * carrying no offset as local time, so the boundary sits at a different moment
 * in every zone, while `ruleId` derives one name for the rule on every host.
 * `docs/specs/2026-09-23-feature-variants.md`, "Determinism across processes",
 * requires one answer per subject per moment in every process.
 *
 * A `Date` that holds an instant passes unread. It carries nothing of the
 * string it was built from, so `new Date('2026-01-01T00:00:00')` has already
 * taken the constructing host's zone before the check sees it, and no reading
 * of the value recovers that. The message for a refused string names that
 * constructor for the same reason: it is the nearest edit to the string being
 * refused, and it moves the divergence out of reach of every check.
 *
 * @throws {FeatureConfigError} when a `before` or `after` condition names no
 * instant a `Date` holds.
 */
export function validateConditions<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
): void {
  for (const rule of definition.rules ?? []) {
    for (const condition of rule.when ?? []) {
      if (condition.op !== 'before' && condition.op !== 'after') continue;
      const fault = windowFault(condition.value);
      if (fault === undefined) continue;

      throw new FeatureConfigError(
        `feature "${String(definition.key)}" has a rule whose "${condition.op}" condition ${fault}`,
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
