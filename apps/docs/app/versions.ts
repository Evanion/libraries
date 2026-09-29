/**
 * What `nx run docs:archives` wrote for each package section, read while the
 * site prerenders.
 *
 * `tools/archives.mjs` writes `content/versions.json` beside the directories it
 * generates: for each section, the release its bare path serves, the retained
 * release lines, and the pages each of them holds. The version switcher reads it
 * to offer each version of the page the reader is on, and to say so when a
 * version does not have that page.
 *
 * Read from disk rather than imported. The file is generated and ignored by git,
 * so an import would fail `tsc` on a checkout that has not run the generator.
 * `output: 'export'` renders every page at build time, so this runs during
 * `next build` and never in a browser.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** One version of a section, as the generator served it. */
export interface ServedVersion {
  /**
   * The x.y.0 release the pages are cut for, or `null` for a package that has
   * none.
   */
  version: string | null;
  /** The newest release of the line, which the pages document too. */
  published: string | null;
  /** The release line's URL segment, `v3` or `v0.2`. */
  segment: string | null;
  /** Whether the pages were cut from git or copied from `content/next/`. */
  from: 'cut' | 'next';
  /** The pages it holds, as paths inside the section; `''` is the index. */
  pages: readonly string[];
}

export interface SectionVersions {
  name: string;
  current: ServedVersion;
  lines: readonly ServedVersion[];
  next: { pages: readonly string[] };
}

let read: Record<string, SectionVersions> | undefined;

/**
 * The directory holding `apps/docs/content`, found from wherever `next build`
 * was started: nx starts it from the workspace root and Next from the app.
 */
function contentDir(): string {
  let at = process.cwd();

  for (;;) {
    for (const candidate of [
      join(at, 'content'),
      join(at, 'apps', 'docs', 'content'),
    ]) {
      if (existsSync(join(candidate, 'versions.json'))) return candidate;
    }

    const up = dirname(at);
    if (up === at)
      throw new Error(
        'content/versions.json is missing. Run `npx nx run docs:archives`.',
      );
    at = up;
  }
}

/** The versions of one section, or `null` for a section with none. */
export function versionsOf(slug: string): SectionVersions | null {
  read ??= (
    JSON.parse(readFileSync(join(contentDir(), 'versions.json'), 'utf8')) as {
      sections: Record<string, SectionVersions>;
    }
  ).sections;

  return read[slug] ?? null;
}
