/**
 * Wraps a fence carrying one of section 5's exemption tags in `<Listing>`.
 *
 *     ```astro no-run
 *     ---
 *     import Widgets from '@evanion/astro-widget/components/Widgets.astro';
 *     ---
 *     ```
 *
 * becomes a `<Listing mark="no-run">` around the same fence, so the block still
 * highlights as `astro` and carries a mark saying nothing ran it.
 *
 * `docs/specs/2026-09-16-documentation-standard.md` § 5 makes this a
 * prerequisite rather than a nicety: it grants five tags that let a fence out of
 * the executed-region rule, and says in the same paragraph that a reader cannot
 * currently tell nine hand-written fences from one executed one, so the site
 * "needs one before the exemptions are safe to grant". Rust marks a listing that
 * does not compile with a Ferris icon; this is that, in the site's own type.
 *
 * The tag stays on the fence rather than moving into the component's props,
 * because the fence is what `tools/repo-checks/src/doc-fence.test.ts` counts and
 * what a reader sees in the source on GitHub. This rewrites what surrounds it
 * and leaves the block itself alone.
 *
 * A loader rather than a remark plugin, for the reason the diagram loader gives:
 * Turbopack takes a loader's module path as a string and fails the build on a
 * config carrying a function.
 */

/** Section 5's closed list, with what each one tells the reader. */
const MARKS = new Set([
  'signature',
  'no-run',
  'anti-example',
  'fails-type-check',
  'elided',
]);

/**
 * Wraps every tagged fence in one MDX source.
 *
 * The same fence scan the diagram loader walks: a fence closes on a marker at
 * least as wide as the one that opened it, so a fence quoting a fence is one
 * block and its inner markers are content.
 */
export function markListings(source) {
  const out = [];
  let fence = null;
  let mark;

  for (const line of source.split('\n')) {
    const marker = line.match(/^(\s*)(`{3,})(.*)$/);
    const opening = marker && fence === null;
    const closing = marker && fence !== null && marker[2].startsWith(fence);

    if (opening) {
      const [, , ticks, info] = marker;
      fence = ticks;
      mark = info
        .trim()
        .split(/\s+/)
        .find((word) => MARKS.has(word));

      if (mark !== undefined) out.push('', `<Listing mark="${mark}">`, '');
      out.push(line);
      continue;
    }

    if (closing) {
      fence = null;
      out.push(line);

      if (mark !== undefined) out.push('', '</Listing>', '');
      mark = undefined;
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * The loader entry point, configured in apps/docs/next.config.ts under
 * `turbopack.rules`.
 */
export default function mdxListingLoader(source) {
  return markListings(source);
}
