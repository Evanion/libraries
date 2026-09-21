import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { expandReferences } from './mdx-reference-loader.mjs';
import { expandRegions } from './mdx-region-loader.mjs';

/**
 * The agent surface of the docs site: one `.md` file beside every page, holding
 * the page's own markdown with its code fences filled in.
 *
 * `docs/specs/2026-09-16-documentation-standard.md` § 5a states the surface and
 * why it is this and why it is no `llms.txt`. The measurement it cites is that
 * 97% of published `llms.txt` files were never requested, so nothing here emits
 * one.
 *
 * **The generation order is the whole point.** A `file=… region=…` fence has no
 * body in `apps/docs/content`; `mdx-region-loader.mjs` fills it during
 * `next build`. All 54 of them are empty in source, so serving raw MDX the way
 * react.dev serves its own would hand an agent 54 blank TypeScript examples.
 * This module runs the same expansions the loaders run, in the same order,
 * which is what puts an unexpanded `.md` file out of reach. A reference entry
 * is the same argument: its signature, its docblock and its example exist
 * nowhere in the page's own source, so a sibling built from raw MDX would hand
 * an agent an HTML comment where the API is.
 *
 * Nothing else is rewritten. A ```mermaid fence stays a fence, because the
 * `<Diagram>` the browser gets is markup around this same source and the fence
 * is what a reader with no browser can use. The components a page mounts stay
 * as written: § 5a asks for the same prose, one more route, and no second
 * document to keep current.
 */

function mdxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * Every page's sibling, keyed by its path under the exported site.
 *
 * `content/urn/api.mdx` is served at `/urn/api/` and its sibling is
 * `/urn/api.md`, which is the shape react.dev publishes and the one an agent
 * guesses. A section's `index.mdx` keeps its name, so `/urn/` gets
 * `/urn/index.md` and no sibling collides with the directory `output: 'export'`
 * writes the page itself into.
 *
 * The landing page is `apps/docs/app/page.tsx` and has no entry here. It is not
 * an MDX document and carries no prose a section page does not carry.
 *
 * A Map, so a test can assert on what the build emits without running the
 * build. `apps/docs/tools/md-siblings.mjs` is the one caller that touches disk.
 */
export function mdSiblings(contentDir, root) {
  const siblings = new Map();

  for (const page of mdxFiles(contentDir).sort()) {
    const route = relative(contentDir, page).split(sep).join('/');

    siblings.set(
      route.replace(/\.mdx$/, '.md'),
      expandRegions(
        expandReferences(readFileSync(page, 'utf8'), root, page),
        root,
        page,
      ),
    );
  }

  return siblings;
}
