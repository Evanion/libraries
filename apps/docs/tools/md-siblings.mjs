import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { mdSiblings } from '@evanion/doc-examples/md-siblings';

/**
 * Writes the site's `.md` siblings into the static export.
 *
 * A file, not a Next route handler. `app/[...mdxPath]/page.tsx` is a required
 * catch-all and owns every path on this site, so a `route.ts` beside it fails
 * the build with "Conflicting route and page at /[...mdxPath]" and there is no
 * other segment a sibling path could come from. Under `output: 'export'` the
 * deployed site is the contents of `out/`, so writing the file is what serving
 * it means.
 *
 * It runs from `postbuild`, ahead of Pagefind, for the reason the docs workflow
 * gives: nx invokes `next build` directly, so npm's lifecycle never fires and
 * the workflow calls `npm run postbuild` as its own step. Pagefind indexes the
 * exported HTML and ignores these.
 *
 * The module it calls carries the ordering constraint.
 */

const app = join(import.meta.dirname, '..');
const out = join(app, 'out');

const siblings = mdSiblings(join(app, 'content'), join(app, '../..'));

for (const [route, markdown] of siblings) {
  const path = join(out, route);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown);
}

console.log(`wrote ${siblings.size} .md siblings to apps/docs/out`);
