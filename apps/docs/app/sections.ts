/**
 * Which package section a route is in, and which version of it.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 1 gives the grammar:
 *
 *     [/next] /<slug> [/v<seg>] /<page>
 *
 * The bare path is the package's newest release, `/<slug>/v<seg>/` is a
 * superseded release line, and `/next/<slug>/` is `main`. Every segment is
 * fixed-length and `<slug>` is exactly one segment, so the grammar reads left to
 * right with no lookahead and no ambiguity: a first segment of `next` opens the
 * `main` tree, and a second segment matching the reserved pattern is a version.
 *
 * One function answers it, and everything on a page that depends on the version
 * -- the hue, the notice, the switcher, the search filter -- asks this rather
 * than reading a path segment of its own.
 */

import { VERSION_SEGMENT } from '../tools/versions.mjs';
import { packages, type DocumentedPackage } from './navigation';

export interface Section {
  /** The package the route documents. */
  entry: DocumentedPackage;
  /** The version segment, or `null` on the bare path and under `/next/`. */
  segment: string | null;
  /** Whether the route is under `/next/`, which builds from `main`. */
  next: boolean;
  /** The page's path inside the section, empty for the section's index. */
  page: readonly string[];
}

/**
 * The section a route is in, or `null` for a route in no package: the testing
 * guide, and anything else outside a package section.
 */
export function packageFor(mdxPath: readonly string[]): Section | null {
  const next = mdxPath[0] === 'next';
  const [slug, ...rest] = next ? mdxPath.slice(1) : mdxPath;
  const entry = packages.find((item) => item.slug === slug);

  if (!entry) return null;

  const versioned =
    !next && rest[0] !== undefined && VERSION_SEGMENT.test(rest[0]);

  return {
    entry,
    segment: versioned ? (rest[0] as string) : null,
    next,
    page: versioned ? rest.slice(1) : rest,
  };
}
