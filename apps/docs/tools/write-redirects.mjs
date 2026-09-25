import { mkdirSync, writeFileSync } from 'node:fs';
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

/** Writes every stub under `out`, and returns what it wrote, keyed by path. */
export function writeRedirects(out) {
  const files = redirectFiles();

  for (const [path, document] of files) {
    const target = join(out, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, document);
  }

  return files;
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const files = writeRedirects(join(import.meta.dirname, '..', 'out'));

  console.log(`wrote ${files.size} redirect stubs to apps/docs/out`);
}
