/**
 * What a package's pages describe, relative to what `npm install` gives you.
 *
 * The site builds from `main` and every package is tagged independently, so
 * there is no commit that is "the released site" and the default view cannot be
 * changed to one. What the reader needs instead is the derived fact: the version
 * on npm, and whether `main` has moved past it.
 *
 * Read from git rather than from the package's `package.json`. `nx release`
 * bumps the manifest at release time, so the manifest equals the tag until the
 * next release and can never say "ahead".
 *
 * This module runs during `next build`. `output: 'export'` renders every page at
 * build time, so the answers are baked into the static HTML and no git call
 * happens in a browser.
 */

import { execFileSync } from 'node:child_process';
import { packages, type DocumentedPackage } from './navigation';

export interface ReleaseState {
  /** The package's folder under `content/`, as in `app/navigation.ts`. */
  slug: string;
  /** The version on npm: the newest tag matching `{name}@*`. */
  published: string | null;
  /** Whether commits touching the package root have landed since that tag. */
  ahead: boolean;
}

/**
 * One git command, or `null` when it cannot answer.
 *
 * Every failure is the same answer here: a build outside a checkout, a clone
 * with no tags, a machine with no git. Each produces a site with no release
 * notices rather than a failed build, which is what a preview build of a
 * downloaded tarball needs.
 */
function git(args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync('git', args as string[], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * The newest release tag for a package, by version rather than by date.
 *
 * `--sort=-v:refname` is git's own version sort, so `10.0.0` follows `9.0.0`
 * instead of preceding it. The pattern is anchored by the `@` that
 * `releaseTag.pattern` in `nx.json` puts between name and version, so
 * `@evanion/urn@*` cannot match another package's tags.
 */
function newestTag(name: string, root: string): string | null {
  const tags = git(
    ['tag', '--list', `${name}@*`, '--sort=-v:refname'],
    root,
  )?.split('\n');

  return tags?.[0] ? tags[0] : null;
}

/**
 * Whether anything under the package's directory has landed since its tag.
 *
 * Path-scoped, because `main` is always ahead of every tag by commits that
 * touched some other package, and saying so on every page would make the notice
 * mean nothing.
 */
function isAhead(tag: string, packageRoot: string, root: string): boolean {
  const count = git(
    ['rev-list', '--count', `${tag}..HEAD`, '--', packageRoot],
    root,
  );

  return count !== null && count !== '0';
}

/** No version on npm: the state of a package with no tag and of a private one. */
function unpublished(entry: DocumentedPackage): ReleaseState {
  return { slug: entry.slug, published: null, ahead: false };
}

function read(entry: DocumentedPackage, root: string): ReleaseState {
  // A private package is versioned and tagged by a release run and published by
  // none, so its tag is not evidence of anything on npm. `WorkshopNotice` is the
  // accurate statement for those pages and it is already on them.
  if (entry.workshop) return unpublished(entry);

  const tag = newestTag(entry.name, root);

  if (!tag) return unpublished(entry);

  return {
    slug: entry.slug,
    published: tag.slice(entry.name.length + 1),
    ahead: isAhead(tag, entry.root, root),
  };
}

/**
 * Every package's release state, read from the repository containing `cwd`.
 *
 * Exported for the tests, which point it at fixture repositories: this one's
 * history changes daily, so asserting a version or an ahead count against it
 * asserts the date.
 */
export function readReleaseStates(
  entries: readonly DocumentedPackage[],
  cwd: string,
): readonly ReleaseState[] {
  const root = git(['rev-parse', '--show-toplevel'], cwd);

  if (!root) return entries.map(unpublished);

  return entries.map((entry) => read(entry, root));
}

let states: readonly ReleaseState[] | undefined;

/**
 * The state for one package section, computed once per build process.
 *
 * `nx build docs` runs from the workspace root and `next build` from the app's
 * directory, so the repository is located with `git rev-parse --show-toplevel`
 * rather than from either. That also resolves a git worktree to the worktree's
 * own root, which is where the branch under test is.
 */
export function releaseState(slug: string): ReleaseState | null {
  states ??= readReleaseStates(packages, process.cwd());

  return states.find((state) => state.slug === slug) ?? null;
}
