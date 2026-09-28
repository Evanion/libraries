import { join } from 'node:path';

import { writeSitemap } from './sitemap.mjs';

/**
 * Writes the sitemap into the static export, from `postbuild`.
 *
 * `sitemap.mjs` carries which pages it lists and why. It runs after the redirect
 * stubs are written, which it leaves out on their own `noindex`, and before
 * Pagefind, which it does not read.
 */

const paths = writeSitemap(join(import.meta.dirname, '..', 'out'));

console.log(`wrote sitemap.xml with ${paths.length} pages to apps/docs/out`);
