/**
 * The widest a one-line object may be before it is broken across lines: what
 * the editor column holds at the reading size, so a line the formatter keeps
 * whole is one the page does not then wrap.
 */
const LINE = 56;

/**
 * `items`, as JSON a reader can take in at a glance.
 *
 * `JSON.stringify(items, null, 2)` puts every key on its own line, which for
 * four items is fifty lines of mostly braces beside a preview a third as tall.
 * This keeps an object on one line while it fits and breaks it only when it
 * does not, so `"meta": { "span": 2 }` reads as one row and a sentence takes
 * the lines it needs. The output is still JSON: parsing it gives back exactly
 * the items it was written from, and `listing.test.ts` holds it to that.
 */
export function listing(value: unknown, indent = ''): string {
  const inner = `${indent}  `;

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const rows = value.map((entry) => inner + listing(entry, inner));
    return `[\n${rows.join(',\n')}\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, entry]) => `${JSON.stringify(key)}: ${listing(entry, inner)}`,
    );
    if (entries.length === 0) return '{}';

    const flat = `{ ${entries.join(', ')} }`;
    const fits = !flat.includes('\n') && indent.length + flat.length <= LINE;
    if (fits) return flat;

    return `{\n${entries.map((entry) => inner + entry).join(',\n')}\n${indent}}`;
  }

  return JSON.stringify(value);
}
