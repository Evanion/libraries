import { workspaceRoot } from '@nx/devkit';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  archiveCandidates,
  missingArchives,
  type ArchiveInputs,
} from './docs-archive';

/**
 * The invariant: no superseded major of a released package has documentation at
 * its tag and nowhere to read it.
 *
 * `docs/specs/2026-09-13-versioned-docs.md` builds the release labelling now and
 * defers the archive, because the whole buildable archive today is four pages.
 * Deferring is safe -- snapshots come from git tags, which are permanent, so the
 * machinery built later captures every release in between -- and its one cost is
 * that somebody has to notice when it stops being deferrable. This is what
 * notices.
 *
 * What trips it is a package taking a major after a tag that carried pages.
 * `@evanion/urn@2.0.0` has four and `@evanion/compose@2.0.0` has one, so the
 * next major of either goes red. Every other package's newest tag predates its
 * section and carries nothing, so it goes red one release later -- the release
 * that supersedes the first tag holding its pages.
 *
 * `docs-navigation.test.ts` is what holds the package list below against
 * `release.projects`, so a released package cannot be missing from this check by
 * being missing from the navigation.
 */

const docsRoot = join(workspaceRoot, 'apps', 'docs');
const contentRoot = join(docsRoot, 'content');

/**
 * Superseded majors that are deliberately not archived yet, each carrying the
 * reason next to it.
 *
 * Adding an entry means writing down why, in the same place the check lives.
 * That is the friction: the spec's answer to a failure is either the archive or
 * a migration page, and a migration page is a legitimate answer once.
 */
const deferred: readonly { tag: string; reason: string }[] = [
  {
    tag: '@evanion/urn@1.1.1',
    reason:
      'urn 1.x is four pages differing from the 2.x tag by 51 added and 3 ' +
      'removed lines, all of them in api.mdx. Publishing those 51 lines costs ' +
      'the whole snapshot pipeline: a worktree per tag, region inlining against ' +
      'the README at that tag, live-element stripping, the page-for-page ' +
      'switcher and a Pagefind version filter. Section 2 of ' +
      'docs/specs/2026-09-13-versioned-docs.md is that measurement.',
  },
];

function git(args: readonly string[]): string {
  return execFileSync('git', args as string[], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function lines(output: string): string[] {
  return output === '' ? [] : output.split('\n');
}

const tags = lines(git(['tag', '--list']));

/** How many files the tree at `tag` carries under `content/<slug>/`. */
function pagesAtTag(tag: string, slug: string): number {
  return lines(
    git([
      'ls-tree',
      '-r',
      '--name-only',
      tag,
      '--',
      `apps/docs/content/${slug}/`,
    ]),
  ).length;
}

/** Whether an archived section for that major exists and holds anything. */
function hasArchive(slug: string, major: number): boolean {
  const directory = join(contentRoot, slug, `v${major}`);

  return existsSync(directory) && readdirSync(directory).length > 0;
}

async function documentedPackages(): Promise<
  readonly { name: string; slug: string }[]
> {
  const module_ = (await import(
    pathToFileURL(join(docsRoot, 'app', 'navigation.ts')).href
  )) as { packages: readonly { name: string; slug: string }[] };

  return module_.packages;
}

async function inputs(): Promise<ArchiveInputs> {
  return {
    packages: await documentedPackages(),
    tags,
    pagesAtTag,
    hasArchive,
  };
}

describe('the docs archive', () => {
  /**
   * A clone with no tags answers this check vacuously, which is a guard that
   * cannot fail. `.github/workflows/ci.yml` checks out with `fetch-depth: 0` for
   * exactly this and for the release notice's own tag lookup.
   */
  it('is checked against a repository that has its tags', () => {
    expect(
      tags.length,
      'No release tags in this checkout, so this check reads nothing. Fetch ' +
        'with `fetch-depth: 0`.',
    ).toBeGreaterThan(0);
  });

  it('exists for every superseded major that has pages at its tag', async () => {
    const excused = new Set(deferred.map((entry) => entry.tag));
    const missing = missingArchives(await inputs()).filter(
      (candidate) => !excused.has(candidate.tag),
    );

    expect(
      missing.map(
        (candidate) =>
          `${candidate.name} ${candidate.major}.x: ${candidate.pages} pages at ` +
          `${candidate.tag} and no apps/docs/content/${candidate.slug}/v${candidate.major}/`,
      ),
      'A major this repository has moved past still has documentation at its ' +
        'tag, and the site no longer shows it. Build the archive -- ' +
        'docs/specs/2026-09-13-versioned-docs.md, sections 4 to 8 -- or write ' +
        'the migration page and add the tag to `deferred` in this file with ' +
        'the reason.',
    ).toEqual([]);
  });

  /**
   * An exception naming a tag that does not exist excuses nothing and reads as
   * though it does. That happens when a tag is renamed or deleted, and it turns
   * the check off for whatever the tag was standing in for.
   */
  it('has no deferred exception that outlives its tag', () => {
    const known = new Set(tags);

    expect(
      deferred.map((entry) => entry.tag).filter((tag) => !known.has(tag)),
    ).toEqual([]);
  });

  /** An excuse for a major that now has its archive is an excuse nobody reads. */
  it('has no deferred exception for a major that is already archived', async () => {
    const candidates = archiveCandidates(await inputs());

    expect(
      deferred
        .map((entry) => candidates.find((it) => it.tag === entry.tag))
        .filter(
          (candidate) =>
            candidate === undefined ||
            hasArchive(candidate.slug, candidate.major),
        )
        .map((candidate) => candidate?.tag ?? '(no candidate)'),
      'Remove the entry from `deferred` in this file: it excuses nothing.',
    ).toEqual([]);
  });
});

/**
 * The rule itself, against fixtures.
 *
 * The repository has one case today and a different set after the next release,
 * so asserting the rule against it asserts this week's history. These fixtures
 * are the four clauses of the rule, each failing without its clause.
 */
describe('the archive rule', () => {
  const packages = [{ name: '@evanion/luhn', slug: 'luhn' }];

  function check(
    tags: readonly string[],
    pages: Record<string, number>,
    archives: readonly string[] = [],
  ) {
    return missingArchives({
      packages,
      tags,
      pagesAtTag: (tag) => pages[tag] ?? 0,
      hasArchive: (slug, major) => archives.includes(`${slug}/v${major}`),
    }).map((candidate) => candidate.tag);
  }

  it('fails a superseded major that has pages and no archive', () => {
    expect(
      check(['@evanion/luhn@2.0.1', '@evanion/luhn@3.0.0'], {
        '@evanion/luhn@2.0.1': 6,
      }),
    ).toEqual(['@evanion/luhn@2.0.1']);
  });

  it('passes once that major has an archive', () => {
    expect(
      check(
        ['@evanion/luhn@2.0.1', '@evanion/luhn@3.0.0'],
        { '@evanion/luhn@2.0.1': 6 },
        ['luhn/v2'],
      ),
    ).toEqual([]);
  });

  it('passes a superseded major whose tag has no pages', () => {
    expect(check(['@evanion/luhn@2.0.1', '@evanion/luhn@3.0.0'], {})).toEqual(
      [],
    );
  });

  /**
   * The current major's pages document the version that is on npm. Filing them
   * as an archive would put two documents under one version number and freeze
   * the one that was replaced.
   */
  it('does not consider the current major however many pages it has', () => {
    expect(
      check(['@evanion/luhn@3.0.0'], { '@evanion/luhn@3.0.0': 6 }),
    ).toEqual([]);
  });

  /** A 0.x package is saying its API is not stable, so it has no major to retain. */
  it('skips a package that has not reached 1.0.0', () => {
    expect(
      check(['@evanion/luhn@0.1.0', '@evanion/luhn@0.2.0'], {
        '@evanion/luhn@0.1.0': 6,
      }),
    ).toEqual([]);
  });

  it('takes the newest tag in a superseded major, not the first', () => {
    expect(
      check(
        ['@evanion/luhn@2.0.0', '@evanion/luhn@2.0.1', '@evanion/luhn@3.0.0'],
        { '@evanion/luhn@2.0.1': 6 },
      ),
    ).toEqual(['@evanion/luhn@2.0.1']);
  });

  /** Lexicographic tag order puts `9.0.0` after `10.0.0`, which inverts "current". */
  it('orders majors numerically', () => {
    expect(
      check(['@evanion/luhn@9.0.0', '@evanion/luhn@10.0.0'], {
        '@evanion/luhn@9.0.0': 6,
      }),
    ).toEqual(['@evanion/luhn@9.0.0']);
  });

  it('reports every superseded major, not only the newest', () => {
    expect(
      check(
        ['@evanion/luhn@1.0.0', '@evanion/luhn@2.0.0', '@evanion/luhn@3.0.0'],
        { '@evanion/luhn@1.0.0': 4, '@evanion/luhn@2.0.0': 6 },
      ),
    ).toEqual(['@evanion/luhn@1.0.0', '@evanion/luhn@2.0.0']);
  });
});
