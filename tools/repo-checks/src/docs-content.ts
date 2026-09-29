import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { workspaceRoot } from '@nx/devkit';

/**
 * Where the docs site's pages are, for the checks that read them.
 *
 * `apps/docs/content/` holds two kinds of page. The ones a person writes: every
 * package section under `content/next/<slug>/`, served at `/next/<slug>/`, and
 * the sections with no version -- the testing guide, and a package section
 * marked `unversioned` in `app/navigation.ts` -- at `content/<slug>/`. And the
 * ones `nx run docs:archives` generates for each release at `content/<slug>/`
 * and `content/<slug>/v<seg>/`, cut from git at a pinned commit and ignored by
 * git.
 *
 * A check of the site's writing reads the first kind only. The second is what a
 * release shipped, frozen, and holding it to a rule written after the release
 * would fail the build on a page nobody may edit. So "authored" is "not ignored
 * by git", which needs no list of which directories are which.
 */

export const DOCS = join(workspaceRoot, 'apps', 'docs');
export const CONTENT = join(DOCS, 'content');
export const NEXT = join(CONTENT, 'next');

/** Every page a person wrote, as absolute paths, sorted. */
export function authoredPages(): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'content'],
    { cwd: DOCS, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map((file) => join(DOCS, file));
}

/**
 * The section a written page belongs to: `acl` for `content/next/acl/api.mdx`,
 * `testing` for `content/testing/index.mdx`.
 */
export function sectionOf(page: string): string {
  const [first, second] = relative(CONTENT, page).split(sep);

  return (first === 'next' ? second : first) as string;
}

/**
 * A written page as its section and its path inside it, `acl/api.mdx` for
 * `content/next/acl/api.mdx`: the key the allowance files name a page by,
 * whichever tree the section is written in.
 */
export function pageKey(page: string): string {
  return relative(CONTENT, page)
    .split(sep)
    .join('/')
    .replace(/^next\//, '');
}

/**
 * The directory a section's written pages are in: `content/next/<slug>/`, or
 * `content/<slug>/` for a section with no version.
 */
export function authoredSection(slug: string): string {
  const next = join(NEXT, slug);

  return existsSync(next) ? next : join(CONTENT, slug);
}

/**
 * The URL path a written page is served at, with the trailing slash the static
 * export gives every page: `content/next/acl/api.mdx` is `/next/acl/api/` and
 * `content/next/acl/index.mdx` is `/next/acl/`.
 */
export function urlOf(page: string): string {
  const path = relative(CONTENT, page)
    .split(sep)
    .join('/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '');

  return path === '' ? '/' : `/${path}/`;
}

/** Every directory holding a written file, `_meta` modules included. */
export function authoredDirectories(): string[] {
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'content'],
    { cwd: DOCS, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .filter(Boolean);

  return [...new Set(files.map((file) => dirname(join(DOCS, file))))].sort();
}

/** One version of a section, as `content/versions.json` records it. */
export interface ServedVersion {
  /** The x.y.0 release the pages are cut for. */
  version: string | null;
  /** The newest release of the line, which the notice names as on npm. */
  published: string | null;
  tag: string | null;
  segment: string | null;
  from: 'cut' | 'next';
  sha?: string;
  dir?: string;
  source?: 'tag' | 'seed' | 'recut';
  reason: string | null;
  pages: string[];
}

export interface ServedSection {
  name: string;
  current: ServedVersion;
  lines: ServedVersion[];
  next: { pages: string[] };
}

/**
 * What `nx run docs:archives` wrote, by slug.
 *
 * `@evanion/repo-checks:test` depends on that target, so the file is there by
 * the time a check reads it; a check run by hand without it says what to run.
 */
export function servedSections(): Record<string, ServedSection> {
  const path = join(CONTENT, 'versions.json');

  if (!existsSync(path))
    throw new Error(
      'apps/docs/content/versions.json is missing. Run `npx nx run docs:archives`.',
    );

  return (
    JSON.parse(readFileSync(path, 'utf-8')) as {
      sections: Record<string, ServedSection>;
    }
  ).sections;
}

/**
 * Every content path the export serves a page at, without its slashes:
 * `acl/api`, `next/acl`, `urn/v1/api`, `testing`.
 *
 * The written pages at the path they are written at, and each generated
 * version directory's pages at the path the generator wrote them.
 */
export function servedPaths(): Set<string> {
  const paths = new Set(
    authoredPages().map((page) => urlOf(page).replace(/^\/|\/$/g, '')),
  );

  for (const [slug, section] of Object.entries(servedSections())) {
    for (const page of section.current.pages)
      paths.add(page === '' ? slug : `${slug}/${page}`);
    for (const line of section.lines)
      for (const page of line.pages)
        paths.add(
          page === ''
            ? `${slug}/${line.segment}`
            : `${slug}/${line.segment}/${page}`,
        );
  }

  return paths;
}
