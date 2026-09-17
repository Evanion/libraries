import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

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

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const FENCE = /^```mermaid([^\n]*)$/gm;
const CAPTION = /(?:^|\s)caption="[^"]+"/;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

describe('docs diagrams', () => {
  it('every mermaid fence carries a caption', () => {
    const uncaptioned: string[] = [];

    for (const page of mdxFiles(CONTENT)) {
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
