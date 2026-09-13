import { VALIDATION_MESSAGES } from './constants.js';
import type { KnownWidgetTypes, WidgetProblem } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Own-key lookup against a caller-supplied object.
 *
 * `in` and a bare index both walk the prototype chain, so a type of
 * `constructor`, `toString` or `__proto__` resolves against `Object.prototype`:
 * the type passes as registered, and `required[type]` comes back as a function
 * for the field loop to iterate. Items are CMS data, so any string is
 * reachable.
 */
function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function knows(known: KnownWidgetTypes, type: string): boolean {
  if (Array.isArray(known)) return known.includes(type);
  return hasOwn(known, type);
}

/**
 * A value a CMS text field that was opened and left empty arrives as.
 */
function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

/**
 * Checks a widget item list against the set of known types, recursing into
 * `children`.
 *
 * Returns problems rather than throwing, and accumulates rather than
 * short-circuiting, so a caller can print all of them at once. No renderer
 * calls this: an adapter stays defensive -- skip the item and warn -- and
 * validation is the loud, explicit gate run at ingestion or build time.
 *
 * `required` maps a widget type to the prop names that must be present and
 * non-blank on `item.props`, where blank means `undefined`, `null` or
 * whitespace only. It is the only check an Astro widget's props get, because an
 * `.astro` component exposes no prop types to infer from; a React consumer
 * wants it for data that never met `WidgetItem<C>`.
 *
 * @example
 * ```ts
 * validateItems([{ id: 'a', type: 'nope', props: {} }], ['news']);
 * // [{ index: 0, id: 'a', type: 'nope', message: 'unknown widget type' }]
 *
 * validateItems([{ id: 'a', type: 'hero', props: {} }], ['hero'], {
 *   hero: ['heading'],
 * });
 * // [{ index: 0, id: 'a', type: 'hero', message: 'missing field heading' }]
 * ```
 */
export function validateItems(
  items: unknown,
  known: KnownWidgetTypes,
  required: Record<string, string[]> = {},
): WidgetProblem[] {
  if (!Array.isArray(items)) {
    return [
      {
        index: -1,
        id: '-',
        type: '-',
        message: VALIDATION_MESSAGES.NOT_A_LIST,
      },
    ];
  }

  const problems: WidgetProblem[] = [];
  const seenIds = new Set<string>();

  items.forEach((item: unknown, index) => {
    if (!isPlainObject(item)) {
      problems.push({
        index,
        id: '-',
        type: '-',
        message: VALIDATION_MESSAGES.NOT_AN_OBJECT,
      });
      return;
    }

    const id = typeof item['id'] === 'string' ? item['id'] : '-';
    const type = typeof item['type'] === 'string' ? item['type'] : '-';

    if (id === '-') {
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.INVALID_ID,
      });
    } else if (seenIds.has(id)) {
      // Only within one sibling list: a renderer scopes keys per list, so the
      // same id at different depths is fine.
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.DUPLICATE_ID,
      });
    } else {
      seenIds.add(id);
    }

    if (type === '-') {
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.INVALID_TYPE,
      });
    } else if (!knows(known, type)) {
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.UNKNOWN_TYPE,
      });
    }

    const props = item['props'];

    // An absent `props` is a problem, not an empty one. A widget's data lives
    // under that key and nowhere else, so an item without it is an item whose
    // props the payload put somewhere the renderer does not read -- which is
    // exactly what a payload written against a flat item shape looks like, and
    // exactly what this check is the migration gate for. A renderer then draws
    // the widget with nothing in it and nothing logged.
    if (!isPlainObject(props)) {
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.INVALID_PROPS,
      });
    } else if (type !== '-' && knows(known, type) && hasOwn(required, type)) {
      // Only for a type the registry declares. An unknown type has already
      // been reported, and listing the fields it did not supply says nothing
      // the first problem did not.
      const fields = required[type] ?? [];
      for (const field of fields) {
        const value = hasOwn(props, field) ? props[field] : undefined;
        if (isBlank(value)) {
          problems.push({
            index,
            id,
            type,
            message: VALIDATION_MESSAGES.MISSING_FIELD(field),
          });
        }
      }
    }

    if (item['children'] !== undefined) {
      if (Array.isArray(item['children'])) {
        problems.push(...validateItems(item['children'], known, required));
      } else {
        problems.push({
          index,
          id,
          type,
          message: VALIDATION_MESSAGES.INVALID_CHILDREN,
        });
      }
    }
  });

  return problems;
}
