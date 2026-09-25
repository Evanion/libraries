import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Every path this site has moved still answers.
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
 * - Every target resolves to a page the content tree carries. A map entry
 *   pointing at a page somebody renamed again sends a reader from one 404 to
 *   another, and the meta refresh means they never see the path that failed.
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

const DOCS = join(workspaceRoot, 'apps/docs');
const CONTENT = join(DOCS, 'content');

/** A markdown link to a root-relative path, as `doc-links.test.ts` reads one. */
const LINK = /\]\((\/[^)\s]*)\)/g;

/**
 * The pages whose links still go through a redirect.
 *
 * Every entry is a page in a section another change owns, so pointing its links
 * at the current path belongs to whoever is editing it. The list is removed from
 * rather than added to: a page is taken off it when its links are updated, and a
 * page arriving on it means somebody wrote a link to a path that has moved.
 */
const allowance = [
  'apps/docs/content/react-acl/api.mdx',
  'apps/docs/content/react-acl/boundary.mdx',
  'apps/docs/content/react-acl/getting-started.mdx',
];

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

interface Redirects {
  movedPages: Map<string, string>;
  redirectFiles: () => Map<string, string>;
}

async function loadRedirects(): Promise<Redirects> {
  return (await import(
    pathToFileURL(join(DOCS, 'tools', 'redirects.mjs')).href
  )) as Redirects;
}

/** Whether the content tree carries the page a site path names. */
function contentPage(path: string): boolean {
  const within = join(CONTENT, path);

  return ['.mdx', '.md'].some(
    (extension) =>
      existsSync(`${within}${extension}`) ||
      existsSync(join(within, `index${extension}`)),
  );
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

  it('point at a page the content tree carries', async () => {
    const { movedPages } = await loadRedirects();

    const broken = [...movedPages]
      .filter(([, to]) => !contentPage(to))
      .map(([from, to]) => `${from} -> ${to}`);

    expect(
      broken.sort(),
      'Each of these redirects to a path with no page under ' +
        'apps/docs/content. A reader following the old link is refreshed ' +
        'straight into a 404.',
    ).toEqual([]);
  });

  it('do not name a path that is a page again', async () => {
    const { movedPages } = await loadRedirects();

    const occupied = [...movedPages.keys()].filter(contentPage);

    expect(
      occupied.sort(),
      'Each of these old paths is a live page again. The redirect writer runs ' +
        'after next build and would overwrite that page with a stub. Remove ' +
        'the entry or rename the page.',
    ).toEqual([]);
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

describe('pages still linking a moved path', () => {
  it('are the ones the allowance names', async () => {
    const { movedPages } = await loadRedirects();

    const stale = mdxFiles(CONTENT)
      .flatMap((page) => {
        const source = readFileSync(page, 'utf8');

        return [...source.matchAll(LINK)]
          .map(([, href]) => (href as string).split('#')[0] as string)
          .filter((href) => movedPages.has(href.replace(/^\//, '')))
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
  it('exists for every moved page, carrying the refresh and the canonical', async () => {
    const { movedPages, redirectFiles } = await loadRedirects();
    const files = redirectFiles();

    expect(files.size).toBe(movedPages.size);

    const wrong = [...movedPages].flatMap(([from, to]) => {
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
    )) as { writeRedirects: (out: string) => Map<string, string> };
    const written = writeRedirects(scratch);

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
