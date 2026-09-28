import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';
import {
  DOCS,
  authoredPages,
  sectionOf,
  servedPaths,
  servedSections,
  urlOf,
} from './docs-content';

/**
 * G7 of `docs/specs/2026-09-25-documentation-standard.md` § 14: an internal
 * link resolves.
 *
 * Nextra fails a build on a `_meta` key naming a page it cannot find and says
 * nothing about a link in prose. A renamed or moved page therefore leaves a 404
 * behind every cross-reference to it, and the only thing that finds one is a
 * reader clicking it.
 *
 * What is checked is the path. The fragment is not: a heading's anchor is
 * produced by Nextra's slugger during the build, and reproducing that here is a
 * second implementation of somebody else's function.
 *
 * A link resolves against the page it is on, the way a browser resolves it: a
 * relative href against the page's URL, which ends in a slash. A link to
 * another package's section is absolute and lands on that package's newest
 * release, which is a directory `nx run docs:archives` generated from a release
 * tag, so it is checked against the pages the release shipped and not against
 * `main`'s. A page `main` has and the release does not answers with a redirect
 * to its copy under `/next/`, which `apps/docs/tools/redirects.mjs` writes, so
 * that counts as resolving too.
 *
 * A path in `redirects.mjs`'s moved pages counts as resolving, because the site
 * serves a file there. It costs the reader a hop, and `doc-redirects.test.ts`
 * carries the ratchet that names the pages still paying it, so accepting the
 * path here does not hide the debt.
 *
 * The own-section rule is `docs/specs/2026-09-13-released-by-default.md`
 * decision 8. A page links another page of its own section relatively, so a
 * section served at `/next/` or at `/<slug>/v<seg>/` links inside that version.
 * An absolute link to the section's own slug leaves the version and lands on
 * the newest release with a 200, which nothing else would notice.
 *
 * The last assertion is the other direction. A package with no section here is
 * linked to its README, and when the section lands the README link keeps
 * resolving -- GitHub serves it, nothing 404s, and three pages went on sending
 * readers off the site after `/react-acl` existed. So an external link to a
 * `documented: true` package's README fails, and the failure names the section.
 */

const APP = join(DOCS, 'app');

/** A markdown link target, or a quoted attribute value, naming a site path. */
const MARKDOWN = /\]\(((?:\.{1,2})?\/[^)\s]*)\)/g;
const ATTRIBUTE = /(['"])((?:\.{1,2})?\/[a-z0-9.#-][^'"\s]*)\1/g;

/** A markdown link to an absolute URL. */
const EXTERNAL = /\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * What `apps/docs/app/navigation.ts` exports, restated rather than imported.
 *
 * An `import type` across the project boundary would put an app's source into
 * this project's compilation, which its tsconfig does not include.
 * `docs-navigation.test.ts` restates the same shape for the same reason.
 */
interface DocumentedPackage {
  root: string;
  slug: string;
  documented: boolean;
}

async function loadNavigation(): Promise<{
  packages: readonly DocumentedPackage[];
  readmeUrl: (entry: DocumentedPackage) => string;
}> {
  return (await import(pathToFileURL(join(APP, 'navigation.ts')).href)) as {
    packages: readonly DocumentedPackage[];
    readmeUrl: (entry: DocumentedPackage) => string;
  };
}

interface Redirects {
  movedPaths: (
    sections: ReturnType<typeof servedSections>,
  ) => Map<string, string>;
  unreleasedPaths: (
    sections: ReturnType<typeof servedSections>,
  ) => Map<string, string>;
}

async function loadRedirects(): Promise<Redirects> {
  return (await import(
    pathToFileURL(join(DOCS, 'tools', 'redirects.mjs')).href
  )) as Redirects;
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

interface Link {
  page: string;
  /** What the page wrote. */
  href: string;
  /** The path it names, without its slashes or its fragment. */
  path: string;
}

/**
 * Every site link on a written page, outside its fences, with the path a
 * browser on that page would resolve it to.
 */
function linksOn(page: string): Link[] {
  const base = urlOf(page);
  const links: Link[] = [];
  let fence: string | null = null;

  for (const line of readFileSync(page, 'utf8').split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (fence === null) fence = marker[1] as string;
      else if ((marker[1] as string).startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;

    // Inline code is code: `api.use('/games', games)` names a route of the
    // reader's server, not a page of this site.
    const prose = line.replace(/`[^`]*`/g, '');

    for (const href of [
      ...[...prose.matchAll(MARKDOWN)].map((match) => match[1] as string),
      ...[...prose.matchAll(ATTRIBUTE)].map((match) => match[2] as string),
    ]) {
      const target = href.split('#')[0] as string;
      const path = (
        target.startsWith('/') ? target : posix.join(base, target)
      ).replace(/^\/|\/$/g, '');

      links.push({ page: relative(workspaceRoot, page), href, path });
    }
  }

  return links;
}

describe('internal links', () => {
  const links = authoredPages().flatMap(linksOn);

  it('finds the links', () => {
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((link) => link.href.startsWith('../'))).toBe(true);
  });

  it('resolve to a page, a route the app defines, or a path the site redirects', async () => {
    const routes = appRoutes();
    const served = servedPaths();
    const sections = servedSections();
    const { movedPaths, unreleasedPaths } = await loadRedirects();
    const redirected = new Set([
      ...movedPaths(sections).keys(),
      ...unreleasedPaths(sections).keys(),
    ]);

    expect(routes.size, 'apps/docs/app defines no route').toBeGreaterThan(0);

    const broken = links.filter(
      ({ path }) =>
        !routes.has(`/${path}`.replace(/^\/$/, '/')) &&
        !(path === '' && routes.has('/')) &&
        !served.has(path) &&
        !redirected.has(path),
    );

    expect(
      [...new Set(broken.map(({ page, href }) => `${page}: ${href}`))].sort(),
      'Each of these links a path the export serves nothing at: no page ' +
        'under apps/docs/content in the tree the link lands in, no route ' +
        'apps/docs/app defines, and no redirect. A link to another package ' +
        "lands on its newest release, whose pages are the release's own.",
    ).toEqual([]);
  });

  it('stay inside their own section by being relative', () => {
    const absolute = links.filter((link) => {
      if (!link.href.startsWith('/')) return false;

      const page = join(workspaceRoot, link.page);
      if (!relative(join(DOCS, 'content', 'next'), page).match(/^[^.]/))
        return false;

      const own = sectionOf(page);
      const [first, second] = link.path.split('/');

      return first === own || (first === 'next' && second === own);
    });

    expect(
      absolute.map(({ page, href }) => `${page}: ${href}`).sort(),
      'Write these relative to the page, `../api` rather than `/urn/api`. A ' +
        'section is served at /next/ and at each release line, and an absolute ' +
        "link to the section's own slug leaves the version the reader is in.",
    ).toEqual([]);
  });
});

describe('README links', () => {
  const external = authoredPages().flatMap((page) => {
    const source = readFileSync(page, 'utf8');

    return [...source.matchAll(EXTERNAL)].map(([, href]) => ({
      page: relative(workspaceRoot, page),
      href: href as string,
    }));
  });

  it('point at the section when the package has one', async () => {
    const { packages, readmeUrl } = await loadNavigation();
    const documented = packages.filter((entry) => entry.documented);

    expect(documented.length, 'no package is documented').toBeGreaterThan(0);

    const stale = external.flatMap(({ page, href }) => {
      const entry = documented.find((item) => href === readmeUrl(item));

      return entry ? [`${page}: ${href} -> /${entry.slug}`] : [];
    });

    expect(
      [...new Set(stale)].sort(),
      'Each of these sends a reader to a README for a package this site ' +
        'documents. Link the section instead -- the path after the arrow.',
    ).toEqual([]);
  });
});
