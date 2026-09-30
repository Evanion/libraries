import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';
import { authoredPages } from './docs-content';

/**
 * The render `/astro-widget/bad-items`'s control shows is the render the
 * current sources produce.
 *
 * `nx run docs:widget-renders` renders each payload through `Widgets.astro`
 * during the docs build and writes `renders.json`, which is not committed.
 * Under Nx the target reruns whenever an input changes. Outside it, a
 * `next build` or a `next dev` reads whatever file an earlier checkout left
 * behind, and the page shows HTML no current widget would render. The
 * generator records a digest of every file the render read, and this test
 * recomputes them.
 *
 * It also holds the control to the page: every payload is a README region the
 * page that mounts the control renders, so the reader can read the code of any
 * payload they pick.
 */

const DOCS = join(workspaceRoot, 'apps/docs');
const RENDERS = join(DOCS, 'components/astro-widget/renders.json');
const README = 'libs/astro-widget/README.md';

interface Renders {
  sources: Record<string, string>;
  payloads: {
    region: string;
    problems: unknown[];
    html: string;
    warnings: string[];
  }[];
}

const REGENERATE =
  'Run `npx nx run docs:widget-renders`, or any docs target, which depends on it.';

function renders(): Renders {
  expect(existsSync(RENDERS), `${RENDERS} is missing. ${REGENERATE}`).toBe(
    true,
  );
  return JSON.parse(readFileSync(RENDERS, 'utf8')) as Renders;
}

describe('the astro-widget render the docs build writes', () => {
  it('read Widgets.astro and the README the payloads came from', () => {
    const sources = Object.keys(renders().sources);

    expect(sources).toContain(README);
    expect(sources).toContain('libs/astro-widget/src/components/Widgets.astro');
  });

  it('was rendered from the files as they are now', () => {
    const stale = Object.entries(renders().sources)
      .filter(([file, digest]) => {
        const path = join(workspaceRoot, file);
        return (
          !existsSync(path) ||
          createHash('sha256').update(readFileSync(path)).digest('hex') !==
            digest
        );
      })
      .map(([file]) => file);

    expect(
      stale,
      `These files changed after renders.json was written. ${REGENERATE}`,
    ).toEqual([]);
  });

  it('holds a render and a report for every payload', () => {
    const { payloads } = renders();

    expect(payloads.length).toBeGreaterThan(1);
    for (const payload of payloads) {
      expect(typeof payload.html, payload.region).toBe('string');
      expect(Array.isArray(payload.problems), payload.region).toBe(true);
      expect(Array.isArray(payload.warnings), payload.region).toBe(true);
    }
    expect(
      payloads.some((payload) => payload.problems.length > 0),
      'The control teaches what the check reports, so it offers a payload ' +
        'that fails it.',
    ).toBe(true);
    expect(payloads.some((payload) => payload.problems.length === 0)).toBe(
      true,
    );
  });

  it('offers only payloads whose code the page mounting it renders', () => {
    const pages = authoredPages()
      .map((path) => readFileSync(path, 'utf8'))
      .filter((source) => /<AstroRenderDemo[\s/>]/.test(source));

    expect(pages, 'Exactly one page mounts <AstroRenderDemo />.').toHaveLength(
      1,
    );

    const cited = new Set(
      [
        ...(pages[0] as string).matchAll(
          /^\s*`{3,}[^\n]*\bfile=(\S+)[^\n]*\bregion=([\w-]+)/gm,
        ),
      ]
        .filter(([, file]) => file === README)
        .map(([, , region]) => region),
    );
    const uncited = renders()
      .payloads.map((payload) => payload.region)
      .filter((region) => !cited.has(region));

    expect(
      uncited,
      `The control offers these ${README} regions and the page renders none ` +
        'of them. Render the region on the page or drop the payload from ' +
        '`apps/docs/tools/widget-renders.mjs`.',
    ).toEqual([]);
  });
});
