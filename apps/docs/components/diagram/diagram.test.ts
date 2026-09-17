import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { expandDiagrams } from '../../tools/mdx-diagram-loader.mjs';
import {
  bindPalette,
  diagramThemeCss,
  diagramThemeVariables,
  strayColours,
} from './palette';

const CONTENT = join(import.meta.dirname, '../../content');
const FENCE = /^```mermaid([^\n]*)\n([\s\S]*?)^```$/gm;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** Every Mermaid fence on the site, with the page it came from. */
function charts(): { page: string; chart: string }[] {
  return mdxFiles(CONTENT).flatMap((page) =>
    [...readFileSync(page, 'utf8').matchAll(FENCE)].map((match) => ({
      page,
      chart: match[2] as string,
    })),
  );
}

describe('the mermaid fence', () => {
  it('becomes a Diagram, with the chart carried verbatim', () => {
    expect(
      expandDiagrams('```mermaid\nflowchart TD\n  A --> B\n```\n'),
    ).toContain('<Diagram chart={"flowchart TD\\n  A --> B"} />');
  });

  it('carries the caption off the fence meta', () => {
    expect(
      expandDiagrams(
        '```mermaid caption="What it shows."\nflowchart TD\n  A --> B\n```\n',
      ),
    ).toContain('caption="What it shows."');
  });

  it('leaves a fence in another language alone', () => {
    const source = '```ts\nconst a = 1;\n```\n';

    expect(expandDiagrams(source)).toBe(source);
  });

  it('leaves a mermaid fence quoted inside a longer fence alone', () => {
    const source = '````md\n```mermaid\nflowchart TD\n  A --> B\n```\n````\n';

    expect(expandDiagrams(source)).toBe(source);
  });
});

/**
 * The palette, checked against the diagrams the site actually ships.
 *
 * `strayColours` is the whole point: Mermaid bakes literal colours into the
 * stylesheet it writes inside the SVG, and the requirement is that none of its
 * own palette reaches the page. Rendering here rather than trusting the variable
 * list is what turns that from a thing someone looked at once into a thing the
 * test suite fails on.
 *
 * jsdom implements no SVG layout, so the geometry these renders produce is
 * wrong. Colour does not depend on geometry, and geometry is checked by looking
 * at the site.
 */
describe('the diagram palette', () => {
  beforeAll(() => {
    Object.assign(SVGElement.prototype, {
      getBBox: () => ({ x: 0, y: 0, width: 100, height: 20 }),
      getComputedTextLength: () => 100,
    });
  });

  async function render(chart: string): Promise<string> {
    const { default: mermaid } = await import('mermaid');

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      look: 'classic',
      themeVariables: diagramThemeVariables,
      themeCSS: diagramThemeCss,
      flowchart: { useMaxWidth: false, htmlLabels: true },
    });

    const { svg } = await mermaid.render('test', chart);
    return bindPalette(svg);
  }

  it('finds the site diagrams', () => {
    expect(charts().length).toBeGreaterThan(0);
  });

  it.each(charts())(
    'leaves no colour of its own in $page',
    async ({ chart }) => {
      expect(strayColours(await render(chart))).toEqual([]);
    },
  );

  it('binds every role to a custom property', async () => {
    const svg = await render('flowchart TD\n  A[one] --> B[two]:::accent\n');

    for (const property of [
      '--baize-ink',
      '--baize-felt',
      '--baize-rule',
      '--baize-chalk',
      '--baize-lichen',
      '--baize-hue',
    ]) {
      expect(svg).toContain(`var(${property}`);
    }
  });
});
