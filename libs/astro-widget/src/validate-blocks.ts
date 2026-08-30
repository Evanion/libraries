import type { BlockItem, BlockProblem, BlockRegistry } from './types';

/**
 * Checks a block list against a registry. Returns problems rather than
 * throwing, so a caller can print all of them at once.
 *
 * `required` maps a block type to the field names that must be present and
 * non-blank.
 */
export function validateBlocks(
  items: BlockItem[],
  registry: BlockRegistry,
  required: Record<string, string[]> = {}
): BlockProblem[] {
  if (!Array.isArray(items)) {
    return [{ index: -1, type: '-', message: 'sektionslistan är inte en lista' }];
  }

  const problems: BlockProblem[] = [];

  items.forEach((item, index) => {
    const type = typeof item?.type === 'string' ? item.type : '-';

    if (!(type in registry)) {
      problems.push({ index, type, message: 'okänd blocktyp' });
    } else {
      for (const field of required[type] ?? []) {
        const value = item[field];
        const blank =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '');
        if (blank) {
          problems.push({ index, type, message: `saknar fältet ${field}` });
        }
      }
    }

    if (Array.isArray(item?.children)) {
      problems.push(...validateBlocks(item.children, registry, required));
    }
  });

  return problems;
}
