import type { BlockItem, BlockProblem, BlockRegistry } from './types';

/**
 * Own-key lookup against a caller-supplied object.
 *
 * `in` and a bare index both walk the prototype chain, so a block typed
 * `constructor`, `toString` or `__proto__` resolves against `Object.prototype`:
 * the type passes as registered, and `required[type]` comes back as a function
 * for the field loop to iterate. Blocks are CMS data, so any string is
 * reachable.
 */
function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/**
 * Checks a block list against a registry, recursing into `children`.
 *
 * Returns problems rather than throwing, and accumulates rather than
 * short-circuiting, so a caller can print all of them at once. `Widgets.astro`
 * never calls this: the renderer skips a block it cannot render, and this is
 * the loud gate to run at ingestion or build time. It is also the only check a
 * block's props get, because an Astro component exposes no prop types to infer
 * from.
 *
 * `required` maps a block type to the field names that must be present and
 * non-blank, where blank means `undefined`, `null` or whitespace only -- a CMS
 * text field that was opened and left empty arrives as the last of those.
 *
 * @example
 * ```ts
 * validateBlocks([{ type: 'hero' }], { hero: Hero }, { hero: ['heading'] });
 * // [{ index: 0, type: 'hero', message: 'missing field heading' }]
 * ```
 */
export function validateBlocks(
  items: BlockItem[],
  registry: BlockRegistry,
  required: Record<string, string[]> = {},
): BlockProblem[] {
  if (!Array.isArray(items)) {
    return [{ index: -1, type: '-', message: 'blocks is not a list' }];
  }

  const problems: BlockProblem[] = [];

  items.forEach((item, index) => {
    const type = typeof item?.type === 'string' ? item.type : '-';

    if (!hasOwn(registry, type)) {
      problems.push({ index, type, message: 'unknown block type' });
    } else {
      const fields = hasOwn(required, type) ? (required[type] ?? []) : [];
      for (const field of fields) {
        const value = hasOwn(item, field) ? item[field] : undefined;
        const blank =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '');
        if (blank) {
          problems.push({ index, type, message: `missing field ${field}` });
        }
      }
    }

    if (Array.isArray(item?.children)) {
      problems.push(...validateBlocks(item.children, registry, required));
    }
  });

  return problems;
}
