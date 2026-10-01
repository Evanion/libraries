import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CONTENT, DOCS, servedSections } from './docs-content';

/**
 * The invariant: the static export serves every version it links, is searchable
 * in the version the reader is in, and tells a crawler which copy of a page to
 * index.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 11 orders these by how
 * silently they fail, and the first two would deploy broken with a green
 * build: a filter Pagefind did not index makes every filtered query return
 * nothing, and a page with no `version` filter is in the index and never found.
 *
 * They read `apps/docs/out`, which only a build writes, and an export left
 * over from an earlier build describes that build. So they run where the build
 * that is about to deploy has just finished: `.github/workflows/docs.yml` runs
 * this file after `npm run postbuild` with `DOCS_EXPORT=required`, and every
 * other run of the repo-checks skips it.
 */

const OUT = join(DOCS, 'out');
const built = existsSync(join(OUT, 'index.html'));
const required = process.env.DOCS_EXPORT === 'required';

/** Every exported page, as its URL path and its HTML. */
function exported(): { path: string; html: string }[] {
  const walk = (dir: string, path: string): { path: string; html: string }[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory())
        return ['_next', '_pagefind', 'behaviour'].includes(entry.name) &&
          path === '/'
          ? []
          : walk(join(dir, entry.name), `${path}${entry.name}/`);
      return entry.name === 'index.html'
        ? [{ path, html: readFileSync(join(dir, entry.name), 'utf-8') }]
        : [];
    });

  return walk(OUT, '/');
}

/** Whether a page asks to be left out of the index. */
const noindex = (html: string) =>
  /<meta name="robots" content="[^"]*\bnoindex\b/.test(html);

/** Whether a page is a redirect stub rather than a page. */
const stub = (html: string) => /http-equiv="refresh"/.test(html);

/**
 * A Pagefind filter file's contents: the filter's name and its values.
 *
 * Pagefind writes each filter as gzipped CBOR behind a `pagefind_dcd`
 * signature: an array of the name and a map from each value to the pages
 * carrying it. This reads as much CBOR as that shape uses -- unsigned
 * integers, text, arrays and maps -- and throws on anything else.
 */
function readFilter(path: string): { name: string; values: string[] } {
  const bytes = gunzipSync(readFileSync(path));
  const signature = 'pagefind_dcd';
  let at = signature.length;

  if (bytes.subarray(0, at).toString('latin1') !== signature)
    throw new Error(`${path} is not a Pagefind file`);

  const length = (info: number): number => {
    if (info < 24) return info;
    const size = { 24: 1, 25: 2, 26: 4 }[info];
    if (size === undefined) throw new Error(`unread CBOR length ${info}`);
    const value = bytes.readUIntBE(at, size);
    at += size;
    return value;
  };

  const read = (): unknown => {
    const head = bytes[at++] as number;
    const major = head >> 5;
    const count = length(head & 31);

    switch (major) {
      case 0:
        return count;
      case 3: {
        const text = bytes.subarray(at, at + count).toString('utf-8');
        at += count;
        return text;
      }
      case 4:
        return Array.from({ length: count }, read);
      case 5:
        return new Map(Array.from({ length: count }, () => [read(), read()]));
      default:
        throw new Error(`unread CBOR major type ${major}`);
    }
  };

  const [name, values] = read() as [string, unknown];
  const keys =
    values instanceof Map
      ? [...values.keys()]
      : (values as unknown[]).map((pair) => (pair as unknown[])[0]);

  return { name, values: (keys as string[]).sort() };
}

describe.runIf(required)('the static export', () => {
  it('is there to read', () => {
    expect(
      built,
      'Build the site first: apps/docs/out has no index.html.',
    ).toBe(true);
  });

  /** § 11.1: a filter nobody indexed returns zero results for every term. */
  it('indexes the version and the package of every page as search filters', () => {
    const directory = join(OUT, '_pagefind', 'filter');
    const filters = new Map(
      readdirSync(directory).map((file) => {
        const { name, values } = readFilter(join(directory, file));
        return [name, values];
      }),
    );
    const sections = servedSections();

    expect(filters.get('version')).toEqual(
      [
        'current',
        'next',
        ...Object.values(sections).flatMap((section) =>
          section.lines.map((line) => line.segment as string),
        ),
      ].sort(),
    );
    expect(filters.get('pkg')).toEqual(
      expect.arrayContaining(Object.keys(sections)),
    );
  });

  /** § 11.2: a page with no `version` is indexed and never found. */
  it('gives every indexed page exactly one version', () => {
    const wrong = exported()
      .filter(({ html }) => html.includes('data-pagefind-body'))
      .map(({ path, html }) => ({
        path,
        count: html.match(/data-pagefind-filter="version:/g)?.length ?? 0,
      }))
      .filter(({ count }) => count !== 1)
      .map(({ path, count }) => `${path}: ${count}`);

    expect(wrong).toEqual([]);
  });

  /**
   * § 11.6: the switcher's entries are decided when the page is rendered, so
   * the export is what shows whether each one landed on a page.
   */
  it('serves every version the switcher offers', () => {
    const missing = exported().flatMap(({ path, html }) => {
      const nav = html.match(/<nav class="docs-versions"[\s\S]*?<\/nav>/)?.[0];
      if (!nav) return [];

      return [...nav.matchAll(/href="([^"]+)"/g)]
        .map((match) => match[1] as string)
        .filter((href) => !existsSync(join(OUT, href, 'index.html')))
        .map((href) => `${path} offers ${href}`);
    });

    expect(missing).toEqual([]);
  });

  /**
   * § 9: a reader on a v1 page who clicks through to the API reference gets
   * v1's. The sidebar, the breadcrumbs and the pager are built from a page map,
   * and the switcher is the one control on the page that leaves the line on
   * purpose. The notice's link to the section's index is the other.
   */
  it('keeps every link on a release line page to its own section inside the line', () => {
    const lines = Object.entries(servedSections()).flatMap(([slug, section]) =>
      section.lines.map((line) => ({
        slug,
        base: `/${slug}/${line.segment}/`,
      })),
    );

    const wrong = exported().flatMap(({ path, html }) => {
      const line = lines.find(({ base }) => path.startsWith(base));
      if (!line) return [];

      const { slug, base } = line;
      const chrome = html.replace(
        /<nav class="docs-versions"[\s\S]*?<\/nav>/g,
        '',
      );

      return [
        ...new Set(
          [...chrome.matchAll(/href="(\/[^"#]*)/g)]
            .map((match) => match[1] as string)
            .filter(
              (href) =>
                href.startsWith(`/${slug}/`) &&
                href !== `/${slug}/` &&
                // The theme links a folder without its trailing slash.
                !`${href}/`.startsWith(base),
            ),
        ),
      ].map((href) => `${path} links ${href}`);
    });

    expect(wrong).toEqual([]);
  });

  /** § 10 and § 11.9: one indexed copy of each page, the release's. */
  it('keeps /next/ and the release lines out of the index and the bare paths in', () => {
    const lines = new Set(
      Object.entries(servedSections()).flatMap(([slug, section]) =>
        section.lines.map((line) => `/${slug}/${line.segment}/`),
      ),
    );
    const secondary = (path: string) =>
      path.startsWith('/next/') ||
      [...lines].some((line) => path.startsWith(line));

    const wrong = exported()
      .filter(({ html }) => !stub(html))
      .filter(({ path }) => !['/404/', '/_not-found/'].includes(path))
      .filter(({ path, html }) => secondary(path) !== noindex(html))
      .map(
        ({ path, html }) => `${path}: ${noindex(html) ? 'noindex' : 'indexed'}`,
      );

    expect(wrong).toEqual([]);
  });

  it('lists exactly the indexed pages in the sitemap', () => {
    const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf-8');
    const listed = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)]
      .map((match) => match[1] as string)
      .sort();

    expect(listed).toEqual(
      exported()
        .filter(({ html }) => !noindex(html))
        .map(({ path }) => path)
        .sort(),
    );
  });

  /**
   * § 11.3 over what deploys. `docs-archive.test.ts` holds
   * `content/versions.json` to the tags, and the build that read it could
   * still be a replay: a cache hit restores `out/` from whatever run stored it,
   * with the bare paths that run served.
   */
  it('serves at each bare path and line the release content/versions.json names', () => {
    const wrong = Object.entries(servedSections()).flatMap(([slug, section]) =>
      [
        { path: `/${slug}/`, version: section.current.version },
        ...section.lines.map((line) => ({
          path: `/${slug}/${line.segment}/`,
          version: line.version,
        })),
      ]
        .filter(({ version }) => version !== null)
        .flatMap(({ path, version }) => {
          const file = join(OUT, path, 'index.html');
          const served = existsSync(file)
            ? readFileSync(file, 'utf-8').match(/data-release="([^"]+)"/)?.[1]
            : undefined;

          return served === version
            ? []
            : [`${path} serves ${served ?? 'no release'}, not ${version}`];
        }),
    );

    expect(wrong).toEqual([]);
  });

  /**
   * § 8 over what deploys. The cut anchors every Twoslash fence on a cut page
   * to the release it documents, and the build renders each one with the
   * release's hovers. A fence the build rendered plain, or a page with
   * compiled fences and no hover, has lost the IntelliSense its release had.
   */
  it('renders every Twoslash fence on a cut page with its hovers', () => {
    const anchored =
      /^\s*\/\/ @filename: node_modules\/\.cache\/docs-archives\//gm;
    const compiled = /<pre [^>]*class="[^"]*\btwoslash lsp\b/g;

    const wrong = Object.entries(servedSections()).flatMap(([slug, section]) =>
      [
        ...(section.current.from === 'cut'
          ? [{ base: slug, pages: section.current.pages }]
          : []),
        ...section.lines.map((line) => ({
          base: `${slug}/${line.segment}`,
          pages: line.pages,
        })),
      ].flatMap(({ base, pages }) =>
        pages.flatMap((page) => {
          const route = page === '' ? base : `${base}/${page}`;
          const source = [`${route}.mdx`, `${route}/index.mdx`]
            .map((file) => join(CONTENT, file))
            .find((file) => existsSync(file));
          if (!source) return [`/${route}/: no page under content/`];

          const fences = (readFileSync(source, 'utf-8').match(anchored) ?? [])
            .length;
          const html = readFileSync(join(OUT, route, 'index.html'), 'utf-8');
          const rendered = (html.match(compiled) ?? []).length;
          const hovers = html.includes('twoslash-popup-container');

          return rendered === fences && (fences === 0 || hovers)
            ? []
            : [
                `/${route}/: ${fences} anchored fences, ${rendered} rendered as Twoslash${hovers ? '' : ', no hover'}`,
              ];
        }),
      ),
    );

    expect(wrong).toEqual([]);
  });

  /** § 11.12: a version directory the copy step left empty. */
  it('writes pages for every version of every section', () => {
    const empty = Object.entries(servedSections()).flatMap(([slug, section]) =>
      [
        `/${slug}/`,
        `/next/${slug}/`,
        ...section.lines.map((line) => `/${slug}/${line.segment}/`),
      ]
        .filter((path) => !existsSync(join(OUT, path, 'index.html')))
        .map((path) => `${path}: no index.html`),
    );

    expect(empty).toEqual([]);
  });
});
