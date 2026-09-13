import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { DocumentedPackage } from './navigation';
import { readReleaseStates } from './release-state';

/**
 * The invariant: a page says which published version it describes, and says so
 * only when there is one.
 *
 * Asserted against fixture repositories rather than this one. This repository's
 * answer is a function of its own history -- every package is ahead of its tag
 * today, and the version numbers change on every release -- so a test written
 * against it asserts the date it was written.
 */

const fixtures: string[] = [];

/** A repository with one commit per entry in `history`, tagged where named. */
function repository(
  history: readonly { path: string; tag?: string }[],
): string {
  const root = mkdtempSync(join(tmpdir(), 'release-state-'));
  fixtures.push(root);

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });

  git('init', '--initial-branch=main');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');
  // A signing key the runner does not have fails the commit, and the developer
  // running this may have commit.gpgsign on globally.
  git('config', 'commit.gpgsign', 'false');

  for (const [index, step] of history.entries()) {
    const file = join(root, step.path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, `${index}\n`);
    git('add', '-A');
    git('commit', '-m', `commit ${index}`);
    if (step.tag) git('tag', step.tag);
  }

  return root;
}

/** A navigation entry for a package under `libs/<slug>`. */
function entry(slug: string, workshop = false): DocumentedPackage {
  return {
    name: `@evanion/${slug}`,
    root: `libs/${slug}`,
    slug,
    title: slug,
    documented: true,
    workshop,
    group: 'standalone',
    framework: 'universal',
    hue: 'citron',
  };
}

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

describe('the release state of a package', () => {
  it('names the published version when nothing has landed since the tag', () => {
    const root = repository([
      { path: 'libs/luhn/index.ts', tag: '@evanion/luhn@3.0.0' },
    ]);

    expect(readReleaseStates([entry('luhn')], root)).toEqual([
      { slug: 'luhn', published: '3.0.0', ahead: false },
    ]);
  });

  it('is ahead when a commit touched the package after its tag', () => {
    const root = repository([
      { path: 'libs/luhn/index.ts', tag: '@evanion/luhn@3.0.0' },
      { path: 'libs/luhn/dictionary.ts' },
    ]);

    expect(readReleaseStates([entry('luhn')], root)).toEqual([
      { slug: 'luhn', published: '3.0.0', ahead: true },
    ]);
  });

  /**
   * `main` runs ahead of every tag by commits belonging to some other package,
   * because the packages are versioned independently. An unscoped `rev-list`
   * would put the unreleased notice on all forty pages permanently, which says
   * nothing.
   */
  it('is not ahead when the commits since the tag belong to another package', () => {
    const root = repository([
      { path: 'libs/luhn/index.ts', tag: '@evanion/luhn@3.0.0' },
      { path: 'libs/urn/index.ts' },
      { path: 'apps/docs/content/luhn/api.mdx' },
    ]);

    expect(readReleaseStates([entry('luhn')], root)).toEqual([
      { slug: 'luhn', published: '3.0.0', ahead: false },
    ]);
  });

  /**
   * Git's default tag order is lexicographic, which puts `9.0.0` after
   * `10.0.0`. The version sort is what stops the tenth major being reported as
   * the published version of a package on its eleventh.
   */
  it('takes the highest version, not the last one alphabetically', () => {
    const root = repository([
      { path: 'libs/luhn/index.ts', tag: '@evanion/luhn@9.0.0' },
      { path: 'libs/luhn/dictionary.ts', tag: '@evanion/luhn@10.0.0' },
    ]);

    expect(readReleaseStates([entry('luhn')], root)[0]?.published).toBe(
      '10.0.0',
    );
  });

  /** Every package's tags carry its own name, so one package cannot read another's. */
  it('reads only the tags carrying its own name', () => {
    const root = repository([
      { path: 'libs/urn/index.ts', tag: '@evanion/urn@2.0.0' },
      { path: 'libs/luhn/index.ts' },
    ]);

    expect(readReleaseStates([entry('luhn')], root)).toEqual([
      { slug: 'luhn', published: null, ahead: false },
    ]);
  });

  /**
   * A release run versions and tags a private package and publishes nothing, so
   * its tag names no version on npm. `WorkshopNotice` is what those pages say
   * instead, and it says more.
   */
  it('names no version for a private package, tagged or not', () => {
    const root = repository([
      { path: 'libs/feature/index.ts', tag: '@evanion/feature@1.0.0' },
    ]);

    expect(readReleaseStates([entry('feature', true)], root)).toEqual([
      { slug: 'feature', published: null, ahead: false },
    ]);
  });

  /**
   * A build from a downloaded tarball, or from a clone with no tags, has to
   * produce the site rather than fail. Nothing is the honest answer there: the
   * notice would be guessing.
   */
  it('names no version outside a git checkout', () => {
    const outside = mkdtempSync(join(tmpdir(), 'release-state-bare-'));
    fixtures.push(outside);

    expect(readReleaseStates([entry('luhn')], outside)).toEqual([
      { slug: 'luhn', published: null, ahead: false },
    ]);
  });
});
