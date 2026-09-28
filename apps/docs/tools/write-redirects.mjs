import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { redirectFiles } from './redirects.mjs';

/**
 * Writes the redirect stubs for every moved path into the static export.
 *
 * `redirects.mjs` carries the map, the document and why a redirect on this site
 * is a file rather than a route.
 *
 * It runs from `postbuild`, ahead of Pagefind, for the reason the docs workflow
 * gives: nx invokes `next build` directly, so npm's lifecycle never fires and
 * the workflow calls `npm run postbuild` as its own step. Each stub carries
 * `<meta name="robots" content="noindex">`, so Pagefind reaching them after
 * this costs a reader nothing.
 *
 * The writing is a function taking its output directory, and the module writes
 * nothing when something imports it. `tools/repo-checks/src/doc-redirects.test.ts`
 * runs this generator into a temporary directory to check that the files land,
 * so the guard exercises the code the build runs; a module that wrote to
 * `out/` on import would have that guard rewrite the deployed export.
 */

/**
 * Writes every stub under `out`, and returns what it wrote, keyed by path.
 *
 * `sections` is what `content/versions.json` records, which names the sections
 * served in both trees and the pages a release left out.
 */
export function writeRedirects(out, sections = {}) {
  const files = redirectFiles(sections);

  for (const [path, document] of files) {
    const target = join(out, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, document);
  }

  return files;
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const docsRoot = join(import.meta.dirname, '..');
  const { sections } = JSON.parse(
    readFileSync(join(docsRoot, 'content', 'versions.json'), 'utf8'),
  );
  const files = writeRedirects(join(docsRoot, 'out'), sections);

  console.log(`wrote ${files.size} redirect stubs to apps/docs/out`);
}
