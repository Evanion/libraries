import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The sitemap of the static export: every page a search engine should index.
 *
 * That is the landing page, the sections with no version, and each package's
 * bare path -- the newest release, which is the copy a reader who installed the
 * package wants. `/next/` and the superseded release lines carry
 * `noindex,follow`, and a redirect stub carries `noindex`, so the rule is read
 * off the page itself: a page is in the sitemap iff it does not ask to be left
 * out of the index. A route added later needs nothing here to be listed, and a
 * page cannot be in the sitemap while telling the crawler not to index it.
 *
 * Built from `out/` after `next build`, because the export is what decides which
 * pages exist.
 */

/** A page asking to be left out of the index. */
const NOINDEX = /<meta name="robots" content="[^"]*\bnoindex\b/;

/** Directories under `out/` that hold assets, not pages. */
const ASSETS = new Set(['_next', '_pagefind', 'behaviour']);

/** Every page's path under `out/`, as the URL path it is served at. */
function pages(out, dir = '') {
  return readdirSync(join(out, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = dir === '' ? entry.name : `${dir}/${entry.name}`;

      if (entry.isDirectory()) return ASSETS.has(path) ? [] : pages(out, path);
      if (entry.name !== 'index.html') return [];

      return [dir === '' ? '/' : `/${dir}/`];
    },
  );
}

/**
 * The URL paths the sitemap lists, sorted.
 *
 * @param {string} out the static export
 */
export function indexedPaths(out) {
  return pages(out)
    .filter(
      (path) =>
        !NOINDEX.test(
          readFileSync(join(out, path.slice(1), 'index.html'), 'utf8'),
        ),
    )
    .sort();
}

/** The sitemap document for a set of paths on one origin. */
export function sitemapDocument(origin, paths) {
  const urls = paths
    .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * Writes `sitemap.xml`, and a `robots.txt` naming it, into the export.
 *
 * The origin is the custom domain `public/CNAME` gives GitHub Pages, so the
 * sitemap names the host the pages are served from.
 *
 * @param {string} out the static export
 */
export function writeSitemap(out) {
  const cname = join(out, 'CNAME');
  const origin = `https://${existsSync(cname) ? readFileSync(cname, 'utf8').trim() : 'localhost'}`;
  const paths = indexedPaths(out);

  writeFileSync(join(out, 'sitemap.xml'), sitemapDocument(origin, paths));
  writeFileSync(
    join(out, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
  );

  return paths;
}
