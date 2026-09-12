import type { BlockItem, BlockProblem, BlockRegistry } from './types';

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
  required: Record<string, string[]> = {}
): BlockProblem[] {
  if (!Array.isArray(items)) {
    return [{ index: -1, type: '-', message: 'blocks is not a list' }];
  }

  const problems: BlockProblem[] = [];

  items.forEach((item, index) => {
    const type = typeof item?.type === 'string' ? item.type : '-';

    if (!(type in registry)) {
      problems.push({ index, type, message: 'unknown block type' });
    } else {
      for (const field of required[type] ?? []) {
        const value = item[field];
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
