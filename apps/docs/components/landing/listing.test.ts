import { describe, expect, it } from 'vitest';
import { demoItems } from './demo';
import { listing } from './listing';

/**
 * What the demo's editor opens with is the data the preview first renders, so
 * the text has to be the items and not a picture of them.
 */
describe('the items listing', () => {
  it('is JSON that parses back to the items the demo renders', () => {
    expect(JSON.parse(listing(demoItems))).toEqual(demoItems);
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
