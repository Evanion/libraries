import { VALIDATION_MESSAGES } from './constants.js';
import type { WidgetComponentMap, WidgetItemProblem } from './types.js';

/**
 * The set of widget types a list may use.
 *
 * A plain list of names is accepted alongside a component map so that a webhook
 * handler or a CI script can validate CMS payloads without importing React
 * components it will never render.
 */
export type KnownWidgetTypes = WidgetComponentMap | readonly string[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function knows(known: KnownWidgetTypes, type: string): boolean {
  if (Array.isArray(known)) return known.includes(type);
  // `in` walks the prototype chain, so "constructor" or "toString" would pass
  // against a component map. Items are untrusted input.
  return Object.prototype.hasOwnProperty.call(known, type);
}

/**
 * Checks a widget item list against the set of known types.
 *
 * Returns problems rather than throwing, and accumulates rather than
 * short-circuiting, so a caller can print all of them at once. The renderer
 * never calls this: `Widgets` stays defensive (skip and warn), and validation
 * is an explicit step run at ingestion or build time. Required props are
 * already checked at compile time by `WidgetItem<C>`; this exists for data that
 * bypasses the type checker.
 */
export function validateItems(
  items: unknown,
  known: KnownWidgetTypes,
): WidgetItemProblem[] {
  if (!Array.isArray(items)) {
    return [
      { index: -1, id: '-', type: '-', message: VALIDATION_MESSAGES.NOT_A_LIST },
    ];
  }

  const problems: WidgetItemProblem[] = [];
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
      // Only within one sibling list: React scopes keys per list, so the same
      // id at different depths is fine.
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

    if (item['props'] !== undefined && !isPlainObject(item['props'])) {
      problems.push({
        index,
        id,
        type,
        message: VALIDATION_MESSAGES.INVALID_PROPS,
      });
    }

    if (item['children'] !== undefined) {
      if (Array.isArray(item['children'])) {
        problems.push(...validateItems(item['children'], known));
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
