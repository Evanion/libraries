import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { mdSiblings } from '@evanion/doc-examples';

/**
 * The agent surface of § 5a of
 * `docs/specs/2026-09-16-documentation-standard.md`: a `.md` file beside every
 * page, holding the page's markdown with its code fences filled in.
 *
 * The assertion the surface exists for is that the fences are filled. A
 * `file=… region=…` fence has no body in `apps/docs/content` — all 54 of them
 * are empty there — so a sibling generated from the raw MDX would serve an
 * agent a page whose every TypeScript example is blank, which is the failure
 * the whole standard is written against, delivered to the reader least able to
 * notice it. `mdSiblings` runs the region expansion the Turbopack loader runs,
 * and this holds it to that.
 *
 * It asserts on the generator's output instead of on `apps/docs/out`, so it
 * says the same thing in seconds and on a checkout that has never been built.
 * `apps/docs/tools/md-siblings.mjs` writes exactly this map, one file per key.
 */

const DOCS = join(workspaceRoot, 'apps/docs');
const CONTENT = join(DOCS, 'content');

/** A fence naming a region, with the body the generator gave it. */
const REFERENCED_FENCE =
  /^[ \t]*(`{3,})\S*[ \t]+file=(\S+)[ \t]+region=([\w-]+).*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;

function countPages(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    if (entry.isDirectory()) return total + countPages(join(dir, entry.name));
    return total + (entry.name.endsWith('.mdx') ? 1 : 0);
  }, 0);
}

/** Every file under a directory, skipping what a build or an install wrote. */
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'out'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe('the .md siblings', () => {
  const siblings = mdSiblings(CONTENT, workspaceRoot);

  it('gives every page one', () => {
    expect(siblings.size).toBe(countPages(CONTENT));
    expect(siblings.has('urn/getting-started.md')).toBe(true);
  });

  it('fills every fence that names a region', () => {
    const empty: string[] = [];

    for (const [route, markdown] of siblings) {
      for (const [, , file, region, body] of markdown.matchAll(
        REFERENCED_FENCE,
      )) {
        if (!body?.trim()) empty.push(`${route}: ${file} region=${region}`);
      }
    }

    expect(empty).toEqual([]);
  });

  it('carries the code of the region a page cites', () => {
    // `libs/urn/README.md`'s `equality` region, which
    // `content/urn/getting-started.mdx` cites and leaves empty.
    expect(siblings.get('urn/getting-started.md')).toContain('URN.equals(');
  });

  it('serves no llms.txt', () => {
    // § 5a rejects the file on measurement: 97% of the ~38,000 published across
    // Ahrefs' May 2026 crawl were never requested, and Google states it ignores
    // them. The siblings are the surface, and a second document to keep current
    // is the cost this avoids paying.
    expect(
      [...siblings.keys()].filter((route) => route.endsWith('llms.txt')),
    ).toEqual([]);
    expect(files(DOCS).filter((path) => path.endsWith('llms.txt'))).toEqual([]);
  });
});
