import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G7 of `docs/specs/2026-09-16-documentation-standard.md` § 12: an internal
 * link resolves.
 *
 * Nextra fails a build on a `_meta` key naming a page it cannot find and says
 * nothing about a link in prose. A renamed or moved page therefore leaves a 404
 * behind every cross-reference to it, and the only thing that finds one is a
 * reader clicking it.
 *
 * § 13 puts this at step 2 so that it is already running when
 * `acl/integrations/` becomes a Platforms band: a link guard that arrives after
 * a URL move has watched nothing.
 *
 * What is checked is the path. The fragment is not: a heading's anchor is
 * produced by Nextra's slugger during the build, and reproducing that here is a
 * second implementation of somebody else's function.
 */

const DOCS = join(workspaceRoot, 'apps/docs');
const CONTENT = join(DOCS, 'content');
const APP = join(DOCS, 'app');

/** A markdown link to a root-relative path. */
const LINK = /\]\((\/[^)\s]*)\)/g;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * The routes `apps/docs/app` defines itself, as paths.
 *
 * A dynamic segment is skipped: `[...mdxPath]` is the catch-all that renders
 * the content tree, and it matches everything, so counting it as a route would
 * make this guard pass on every link.
 */
function appRoutes(): Set<string> {
  const found = new Set<string>();

  const walk = (directory: string, path: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('[')) continue;
        // A route group -- `(marketing)` -- names no segment.
        const segment = entry.name.startsWith('(')
          ? path
          : `${path}/${entry.name}`;
        walk(join(directory, entry.name), segment);
      } else if (/^page\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        found.add(path === '' ? '/' : path);
      }
    }
  };

  walk(APP, '');
  return found;
}

/** Whether the content tree carries the page a path names. */
function contentPage(path: string): boolean {
  const within = join(CONTENT, path);

  return ['.mdx', '.md'].some(
    (extension) =>
      existsSync(`${within}${extension}`) ||
      existsSync(join(within, `index${extension}`)),
  );
}

describe('internal links', () => {
  const links = mdxFiles(CONTENT).flatMap((page) => {
    const source = readFileSync(page, 'utf8');

    return [...source.matchAll(LINK)].map(([, href]) => ({
      page: relative(workspaceRoot, page),
      href: href as string,
    }));
  });

  it('finds the links', () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it('resolve to a page or a route the app defines', () => {
    const routes = appRoutes();

    expect(routes.size, 'apps/docs/app defines no route').toBeGreaterThan(0);

    const broken = links.filter(({ href }) => {
      const path = (href.split('#')[0] as string).replace(/\/$/, '');

      return !routes.has(path === '' ? '/' : path) && !contentPage(path);
    });

    expect(
      [...new Set(broken.map(({ page, href }) => `${page}: ${href}`))].sort(),
      'Each of these links a path that is neither a page under ' +
        'apps/docs/content nor a route apps/docs/app defines. Nextra renders ' +
        'the link and serves a 404.',
    ).toEqual([]);
  });
});
