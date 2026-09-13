import { describe, expect, it } from 'vitest';
import { items } from './items';
import { listing } from './listing';

/**
 * What the "Rendering from data" section shows is the page's own items, so the
 * text on the page has to be the data and not a picture of it.
 */
describe('the items listing', () => {
  it('is JSON that parses back to the items the page rendered', () => {
    expect(JSON.parse(listing(items))).toEqual(items);
  });

  it('composes the same array item by item, as the page sets it', () => {
    const composed = `[${items.map((item) => listing(item, '  ')).join(',')}]`;

    expect(JSON.parse(composed)).toEqual(items);
  });

  it('keeps a short object on one line and breaks a long one', () => {
    const text = listing([
      { id: 'a', meta: { rule: true } },
      { id: 'd', props: { line: 'x'.repeat(80) } },
    ]);

    expect(text).toContain('  { "id": "a", "meta": { "rule": true } },');
    expect(text).toContain('  {\n    "id": "d",\n    "props": {\n');
  });
});
