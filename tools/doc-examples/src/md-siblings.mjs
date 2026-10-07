import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

import { expandReferences } from './mdx-reference-loader.mjs';
import { expandRegions } from './mdx-region-loader.mjs';

/**
 * The agent surface of the docs site: one `.md` file beside every page, holding
 * the page's own markdown with its code fences filled in.
 *
 * `docs/specs/2026-09-25-documentation-standard.md` § 10 states the surface and
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
 * A relative link is made absolute. A page links to a page in its own section
 * relatively, so the link stays inside whichever version of the section the
 * reader is in, and a browser resolves it against the page's URL, which ends in
 * a slash. A sibling is served one level up from that, at `/urn/api.md`, so the
 * same href would resolve one segment short. Resolved here against the page's
 * own route, the link names the page it named in the browser.
 *
 * A Twoslash fence loses everything above its last `// ---cut---`. Twoslash
 * compiles those lines and renders none of them, so the browser shows the code
 * below the cut, and the sibling shows the same code. Most of those lines are a
 * package's preamble, which the region expansion put there for the compiler.
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
 * The URL a page is served at, which is what its relative links resolve
 * against: `urn/api.mdx` is `/urn/api/` and `urn/index.mdx` is `/urn/`.
 */
function pageUrl(route) {
  const path = route.replace(/\.mdx$/, '').replace(/(^|\/)index$/, '');

  return path === '' ? '/' : `/${path}/`;
}

/**
 * Every relative link on a page, made absolute against the page's URL.
 *
 * A markdown link target and a quoted attribute value are the two places a
 * page writes one: `[Usage](../usage)` in prose and
 * `requires={[['Usage', '../usage']]}` on a component. A fence is left alone,
 * because what is inside it is code a reader copies.
 */
export function absoluteLinks(markdown, route) {
  const base = pageUrl(route);
  const resolve = (href) => {
    const [path, ...hash] = href.split('#');
    const resolved = posix.join(base, path);

    return [resolved, ...hash].join('#');
  };
  let fence = null;

  return markdown
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);

      if (marker) {
        if (fence === null) fence = marker[1];
        else if (marker[1].startsWith(fence)) fence = null;
        return line;
      }
      if (fence !== null) return line;

      return line
        .replace(
          /\]\((\.{1,2}\/[^)\s]*)\)/g,
          (_, href) => `](${resolve(href)})`,
        )
        .replace(
          /(['"])(\.{1,2}\/[^'"\s]*)\1/g,
          (_, quote, href) => `${quote}${resolve(href)}${quote}`,
        );
    })
    .join('\n');
}

/**
 * Every Twoslash fence with the lines above its last `// ---cut---` removed,
 * the marker included. A fence with no cut, or no `twoslash` in its info
 * string, is left as written, because only Twoslash reads the marker.
 *
 * The last, because Twoslash renders from the last one: a region that hides
 * setup behind a cut of its own gets a second cut when the region expansion
 * puts the package's preamble in front of it.
 */
function cutFences(markdown) {
  const out = [];
  let fence = null;

  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (fence === null) {
      out.push(line);
      if (marker)
        fence = {
          ticks: marker[1],
          twoslash: /\btwoslash\b/.test(marker[2]),
          body: [],
        };
      continue;
    }

    if (marker && marker[1].startsWith(fence.ticks)) {
      const cut = fence.twoslash
        ? fence.body.map((body) => body.trim()).lastIndexOf('// ---cut---')
        : -1;
      out.push(...fence.body.slice(cut + 1), line);
      fence = null;
      continue;
    }

    fence.body.push(line);
  }

  if (fence !== null) out.push(...fence.body);

  return out.join('\n');
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
      absoluteLinks(
        cutFences(
          expandRegions(
            expandReferences(readFileSync(page, 'utf8'), root, page),
            root,
            page,
          ),
        ),
        route,
      ),
    );
  }

  return siblings;
}
