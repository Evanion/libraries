import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';
import { parseRegions } from '@evanion/doc-examples';

/**
 * The docs app fills `file=… region=…` code blocks from the packages' READMEs
 * at build time, and a bad reference fails `next build`.
 *
 * That build is slow and runs late. This runs in `nx test`, so a renamed
 * region is caught in seconds rather than at the end of CI.
 *
 * The two keys are matched anywhere in the info string rather than immediately
 * after the language, because a region fence on this site usually carries
 * `twoslash` between them and an anchored pattern reads none of those fences at
 * all. `apps/docs/content/acl` alone writes most of its references that way, so
 * the anchored form left the majority of the site's regions checked by nothing
 * but `next build`. `mdx-region-loader.mjs` never had the bug; its own
 * `/(?:^|\s)file=(\S+)\s+region=([\w-]+)/` reads the keys wherever they sit,
 * which is why the fixtures below pass while the scan above them saw nothing.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const REFERENCE = /^\s*`{3,}[^\n]*\bfile=(\S+)[^\n]*\bregion=([\w-]+)/gm;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

describe('doc region references', () => {
  const pages = mdxFiles(CONTENT);

  it('finds the docs content', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('reads the keys past a twoslash marker, which is how most of the site writes them', () => {
    const source =
      '```ts twoslash file=libs/urn/README.md region=equality\n```';

    expect(
      [...source.matchAll(REFERENCE)].map(([, path, name]) => [path, name]),
    ).toEqual([['libs/urn/README.md', 'equality']]);
  });

  it('counts the references the site actually carries', () => {
    const referenced = pages.reduce(
      (total, page) =>
        total + [...readFileSync(page, 'utf8').matchAll(REFERENCE)].length,
      0,
    );

    // A guard whose scan matches nothing passes every assertion under it. This
    // is the floor that says the scan is still reading the site.
    expect(referenced).toBeGreaterThan(50);
  });

  it('every referenced file and region exists', () => {
    const missing: string[] = [];

    for (const page of pages) {
      const source = readFileSync(page, 'utf8');

      for (const [, path, name] of source.matchAll(REFERENCE)) {
        const target = join(workspaceRoot, path as string);
        let contents: string;

        try {
          contents = readFileSync(target, 'utf8');
        } catch {
          missing.push(`${page}: cannot read ${path}`);
          continue;
        }

        if (!parseRegions(contents, path as string).has(name as string)) {
          missing.push(`${page}: ${path} has no region '${name}'`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('expands a reference to the region body', () => {
    const source = [
      '```ts file=libs/urn/README.md region=equality',
      '```',
    ].join('\n');

    expect(expandRegions(source, workspaceRoot, 'test.mdx')).toContain(
      'URN.equals(',
    );
  });

  it('drops whatever the referencing block already held', () => {
    const source = [
      '```ts file=libs/urn/README.md region=equality',
      'stale();',
      '```',
    ].join('\n');

    expect(expandRegions(source, workspaceRoot, 'test.mdx')).not.toContain(
      'stale()',
    );
  });

  it('carries the fence meta through to the expanded block', () => {
    const source = [
      '```ts twoslash file=libs/urn/README.md region=equality',
      '```',
    ].join('\n');

    expect(expandRegions(source, workspaceRoot, 'test.mdx')).toContain(
      '```ts twoslash\n',
    );
  });

  it('takes the language from the region when the block names none', () => {
    const source = ['```file=libs/urn/README.md region=equality', '```'].join(
      '\n',
    );

    expect(expandRegions(source, workspaceRoot, 'test.mdx')).toContain(
      '```ts\n',
    );
  });

  it('leaves an ordinary code block alone', () => {
    const source = ['```ts', 'const x = 1;', '```'].join('\n');

    expect(expandRegions(source, workspaceRoot, 'test.mdx')).toBe(source);
  });

  it('fails on a region that does not exist', () => {
    const source = ['```ts file=libs/urn/README.md region=nope', '```'].join(
      '\n',
    );

    expect(() => expandRegions(source, workspaceRoot, 'test.mdx')).toThrow(
      /no region 'nope'/,
    );
  });

  it('fails on a file that does not exist', () => {
    const source = ['```ts file=libs/nope/README.md region=x', '```'].join(
      '\n',
    );

    expect(() => expandRegions(source, workspaceRoot, 'test.mdx')).toThrow(
      /cannot read/,
    );
  });
});
