/**
 * Messages an adapter's renderer passes to {@link warnOnce}.
 *
 * Each one names the offending item's `id` and `type`, which is what lets
 * `warnOnce` key on the message text and still report a second bad item
 * separately.
 *
 * They live here rather than in each adapter so that a region rendered through
 * React and the same region rendered through Astro report a stale CMS type in
 * the same words.
 */
export const ERROR_MESSAGES = {
  UNKNOWN_WIDGET: (type: string, id: string) =>
    `Unknown widget type "${type}" for widget ID "${id}". Skipping render.`,
  UNKNOWN: 'unknown',
  MALFORMED_ITEMS:
    'Malformed `items` prop: expected an array of widget items. Skipping render.',
  MALFORMED_ITEM: (id: string | undefined, type: unknown) =>
    `Malformed widget item (id="${id ?? 'unknown'}", type="${typeof type === 'string' ? type : 'unknown'}"). Skipping render.`,
  MALFORMED_CHILDREN: (id: string) =>
    `Malformed \`children\` on widget item (id="${id}"): expected an array. Rendering the widget without them.`,
} as const;

/**
 * Messages reported by {@link validateItems}.
 *
 * Exported so a caller can group or translate problems without matching on
 * prose, and so the tests assert against the same strings the library emits.
 */
export const VALIDATION_MESSAGES = {
  NOT_A_LIST: 'items is not a list',
  NOT_AN_OBJECT: 'item is not an object',
  INVALID_ID: 'item id is not a string',
  INVALID_TYPE: 'item type is not a string',
  UNKNOWN_TYPE: 'unknown widget type',
  INVALID_PROPS: 'props is not an object',
  INVALID_CHILDREN: 'children is not a list',
  DUPLICATE_ID: 'duplicate sibling id',
  /**
   * A field the caller's `required` map demands is absent or blank.
   *
   * A function rather than a constant because the field name is the whole of
   * the report: a CMS editor reads "missing field heading" and knows which box
   * to fill.
   */
  MISSING_FIELD: (field: string) => `missing field ${field}`,
} as const;
