import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DOCS,
  authoredPages,
  servedPaths,
  servedSections,
  urlOf,
} from './docs-content';

/**
 * Every path this site has moved still answers, in every tree it is served in.
 *
 * `apps/docs/next.config.ts` sets `output: 'export'`, so Next's `redirects()`
 * never runs: it needs a server and GitHub Pages serves files. A renamed page
 * therefore 404s at its old path unless something writes a file there, and
 * `apps/docs/tools/write-redirects.mjs` is that something, from `postbuild`.
 *
 * A redirect nothing checks is a redirect that rots, and it rots quietly: the
 * only reader who finds out is one following a link that used to work. Four
 * things are checked here, and each is a way the map and the site come apart.
 *
 * - Every target resolves to a page the site serves. A map entry pointing at a
 *   page somebody renamed again sends a reader from one 404 to another, and the
 *   meta refresh means they never see the path that failed. A package section
 *   is served at its bare path and again under `/next/`, so a moved page
 *   answers in both, and both targets are checked: the bare one against the
 *   pages the newest release shipped. A release that still has the page under
 *   its old name serves it there, and gets no stub.
 * - No entry's own path is a live page. A map key that a page now occupies
 *   would have the generator overwrite that page's `index.html` in `out/`,
 *   after Next wrote it, which deletes the page and reports nothing.
 * - No target is itself a key. A reader would walk two refreshes, and a cycle
 *   would walk forever.
 * - The generator writes a file at each entry's path, and the file carries the
 *   refresh and the canonical link. This runs the real generator into a
 *   temporary directory, so what is checked is the code the build runs rather
 *   than a restatement of it.
 *
 * What this cannot reach is the deployed site. It holds the map and the
 * generator to each other and to the content tree; that the workflow runs
 * `npm run postbuild` is `.github/workflows/docs.yml`'s, and
 * `apps/docs/tools/md-siblings.mjs` already depends on the same step.
 *
 * On the idiom of `doc-links.test.ts`: the content tree is read from disk and
 * `apps/docs` modules are imported by file URL rather than by package path,
 * because an `import` across the project boundary would put an app's source
 * into this project's compilation, which its tsconfig does not include.
 */

/** A markdown link to a site path, as `doc-links.test.ts` reads one. */
const LINK = /\]\(((?:\.{1,2})?\/[^)\s]*)\)/g;

/**
 * Every entry is a page in a section another change owns, so pointing its links
 * at the current path belongs to whoever is editing it. The list is removed from
 * rather than added to: a page is taken off it when its links are updated, and a
 * page arriving on it means somebody wrote a link to a path that has moved.
 */
const allowance: string[] = [];

interface Redirects {
  movedPages: Map<string, string>;
  movedPaths: (
    sections: ReturnType<typeof servedSections>,
  ) => Map<string, string>;
  unreleasedPaths: (
    sections: ReturnType<typeof servedSections>,
  ) => Map<string, string>;
  redirectFiles: (
    sections: ReturnType<typeof servedSections>,
  ) => Map<string, string>;
}

async function loadRedirects(): Promise<Redirects> {
  return (await import(
    pathToFileURL(join(DOCS, 'tools', 'redirects.mjs')).href
  )) as Redirects;
}

const scratch = mkdtempSync(join(tmpdir(), 'doc-redirects-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('moved pages', () => {
  it('names some', async () => {
    const { movedPages } = await loadRedirects();

    expect(movedPages.size).toBeGreaterThan(0);
  });

  it('point at a page the site serves, in every tree they are served in', async () => {
    const { movedPaths } = await loadRedirects();
    const served = servedPaths();

    const broken = [...movedPaths(servedSections())]
      .filter(([, to]) => !served.has(to))
      .map(([from, to]) => `${from} -> ${to}`);

    expect(
      broken.sort(),
      'Each of these redirects to a path the export serves no page at. A ' +
        'reader following the old link is refreshed straight into a 404.',
    ).toEqual([]);
  });

  it('do not name a path that is a page again', async () => {
    const { movedPaths } = await loadRedirects();
    const served = servedPaths();

    const occupied = [...movedPaths(servedSections()).keys()].filter((path) =>
      served.has(path),
    );

    expect(
      occupied.sort(),
      'Each of these old paths is a live page again. The redirect writer runs ' +
        'after next build and would overwrite that page with a stub. Remove ' +
        'the entry or rename the page.',
    ).toEqual([]);
  });

  /**
   * A page renamed on `main` is still under its old name in the release the
   * bare path serves until the next release, and a stub there would overwrite
   * it.
   */
  it('leave the bare path to a release that still has the page under its old name', async () => {
    const { movedPages, movedPaths } = await loadRedirects();
    const [from, to] = [...movedPages].find(([path]) =>
      path.startsWith('acl/'),
    ) as [string, string];
    const page = (path: string) => path.slice('acl/'.length);
    const served = (pages: string[]) =>
      movedPaths({
        acl: { current: { pages } },
      } as unknown as ReturnType<typeof servedSections>);

    expect(served([page(from)]).has(from)).toBe(false);
    expect(served([page(from)]).get(`next/${from}`)).toBe(`next/${to}`);
    expect(served([page(to)]).get(from)).toBe(to);
    expect(served([]).get(from)).toBe(`next/${to}`);
  });

  it('resolve in one hop', async () => {
    const { movedPages } = await loadRedirects();

    const chained = [...movedPages]
      .filter(([, to]) => movedPages.has(to))
      .map(([from, to]) => `${from} -> ${to} -> ${movedPages.get(to)}`);

    expect(
      chained.sort(),
      'Each of these sends a reader through two refreshes. Point the first ' +
        'entry at the current path.',
    ).toEqual([]);
  });
});

describe('pages a release left out', () => {
  /**
   * A bare path serves what a release shipped, and `main` has pages it did
   * not. The bare path of each is a path a search engine may already hold, so
   * it answers with the page under `/next/`, and that page has to be there.
   */
  it('redirect to the copy under /next/', async () => {
    const { unreleasedPaths } = await loadRedirects();
    const sections = servedSections();
    const served = servedPaths();
    const unreleased = unreleasedPaths(sections);

    expect(
      [...unreleased]
        .filter(([from, to]) => served.has(from) || !served.has(to))
        .map(([from, to]) => `${from} -> ${to}`),
    ).toEqual([]);
  });
});

describe('pages still linking a moved path', () => {
  it('are the ones the allowance names', async () => {
    const { movedPages } = await loadRedirects();

    const stale = authoredPages()
      .flatMap((page) => {
        const source = readFileSync(page, 'utf8');

        return [...source.matchAll(LINK)]
          .map(([, href]) => {
            const target = (href as string).split('#')[0] as string;
            return (
              target.startsWith('/') ? target : posix.join(urlOf(page), target)
            )
              .replace(/^\/|\/$/g, '')
              .replace(/^next\//, '');
          })
          .filter((path) => movedPages.has(path))
          .map(() => relative(workspaceRoot, page));
      })
      .map((path) => path.split(sep).join('/'));

    expect(
      [...new Set(stale)].sort(),
      'A link to a moved path still reaches the page, through a refresh the ' +
        'reader pays for. Point it at the current path and remove the entry ' +
        'here. Adding a page to this list is how the debt grows.',
    ).toEqual(allowance);
  });
});

describe('the redirect the build writes', () => {
  it('exists for every moved page in each tree, carrying the refresh and the canonical', async () => {
    const { movedPaths, redirectFiles } = await loadRedirects();
    const sections = servedSections();
    const files = redirectFiles(sections);
    const moved = movedPaths(sections);

    expect(
      [...moved.keys()].filter((from) => from.startsWith('next/')).length,
      'no moved page is in a section served under /next/',
    ).toBeGreaterThan(0);

    const wrong = [...moved].flatMap(([from, to]) => {
      const document = files.get(`${from}/index.html`);
      if (document === undefined) return [`${from}: no file written`];

      const href = `/${to}/`;
      const faults: string[] = [];

      if (!document.includes(`http-equiv="refresh" content="0; url=${href}"`)) {
        faults.push(`${from}: no meta refresh to ${href}`);
      }
      if (!document.includes(`rel="canonical" href="${href}"`)) {
        faults.push(`${from}: no canonical link to ${href}`);
      }

      return faults;
    });

    expect(
      wrong.sort(),
      'A stub without the refresh leaves the reader on a blank page, and one ' +
        'without the canonical splits the search index across both paths.',
    ).toEqual([]);
  });

  it('lands at the path the site serves it from', async () => {
    const { writeRedirects } = (await import(
      pathToFileURL(join(DOCS, 'tools', 'write-redirects.mjs')).href
    )) as {
      writeRedirects: (
        out: string,
        sections: ReturnType<typeof servedSections>,
      ) => Map<string, string>;
    };
    const written = writeRedirects(scratch, servedSections());

    const missing = [...written.keys()].filter(
      (path) => !existsSync(join(scratch, path)),
    );

    expect(
      missing.sort(),
      'The generator reported these and wrote none',
    ).toEqual([]);

    const first = [...written.keys()][0] as string;
    expect(readFileSync(join(scratch, first), 'utf8')).toContain(
      'http-equiv="refresh"',
    );
  });
});
