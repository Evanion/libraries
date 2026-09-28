import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authoredPages } from './docs-content';

/**
 * A diagram on the docs site is a figure, and a figure says what it shows.
 *
 * The caption is not decoration. It is the claim the picture makes, it is the
 * accessible description for a reader who cannot see the picture, and it is the
 * only part of a diagram that reaches the static HTML -- the diagram itself is
 * drawn in the browser, so search does not index it and a reader with no
 * JavaScript never sees it.
 *
 * `components/diagram/Diagram.tsx` renders the caption from the fence's meta.
 * Nothing in the build fails without one, which is why this does.
 */

const FENCE = /^```mermaid([^\n]*)$/gm;
const CAPTION = /(?:^|\s)caption="[^"]+"/;

describe('docs diagrams', () => {
  it('every mermaid fence carries a caption', () => {
    const uncaptioned: string[] = [];

    for (const page of authoredPages()) {
      const source = readFileSync(page, 'utf8');

      for (const [, meta] of source.matchAll(FENCE)) {
        if (!CAPTION.test(meta as string)) {
          uncaptioned.push(page);
        }
      }
    }

    expect(uncaptioned).toEqual([]);
  });
});
