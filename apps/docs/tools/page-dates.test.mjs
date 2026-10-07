import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { pageTime, sourceOf } from './page-dates.mjs';

/**
 * The invariant: a page's "Last updated" time is the committer time of the
 * last commit that changed the file the page was written from, whether a
 * person wrote it or `nx run docs:archives` generated it.
 */

const fixtures = [];

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

const DAY = 86_400;

/**
 * A repository with one commit per step, each committed a day after the last,
 * and the SHA of every commit.
 */
function repository(steps) {
  const root = mkdtempSync(join(tmpdir(), 'docs-page-dates-'));
  fixtures.push(root);

  const git = (args, env = {}) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    }).trim();

  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'fixture@example.com']);
  git(['config', 'user.name', 'Fixture']);
  git(['config', 'commit.gpgsign', 'false']);

  const shas = steps.map((step, index) => {
    for (const [path, contents] of Object.entries(step.files ?? {})) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), contents);
    }
    for (const path of step.remove ?? []) rmSync(join(root, path));
    git(['add', '-A']);
    const date = `@${(index + 1) * DAY} +0000`;
    git(['commit', '-m', `step ${index}`], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return git(['rev-parse', 'HEAD']);
  });

  return { root, shas };
}

const at = (step) => (step + 1) * DAY * 1000;

function siteIn(root, sections) {
  const docsRoot = join(root, 'apps/docs');
  mkdirSync(join(docsRoot, 'content'), { recursive: true });
  writeFileSync(
    join(docsRoot, 'content/versions.json'),
    JSON.stringify({ sections }),
  );
  return { workspaceRoot: root, docsRoot };
}

describe('the source of a page', () => {
  const sections = {
    urn: {
      current: { from: 'cut', sha: 'c2', dir: 'apps/docs/content/next/urn' },
      lines: [{ segment: 'v1', sha: 'c1', dir: 'apps/docs/content/urn' }],
    },
    luhn: { current: { from: 'next' }, lines: [] },
  };
  const source = (file) => sourceOf(sections, 'apps/docs/content', file);

  it('is a written page itself, at HEAD', () => {
    expect(source('next/urn/api.mdx')).toEqual({
      commit: 'HEAD',
      path: 'apps/docs/content/next/urn/api.mdx',
    });
    expect(source('testing/index.mdx')).toEqual({
      commit: 'HEAD',
      path: 'apps/docs/content/testing/index.mdx',
    });
  });

  it("is a cut page's file at the commit its version was cut from", () => {
    expect(source('urn/api.mdx')).toEqual({
      commit: 'c2',
      path: 'apps/docs/content/next/urn/api.mdx',
    });
    expect(source('urn/v1/guide/index.mdx')).toEqual({
      commit: 'c1',
      path: 'apps/docs/content/urn/guide/index.mdx',
    });
  });

  it('is the original of a page copied from content/next/, at HEAD', () => {
    expect(source('luhn/index.mdx')).toEqual({
      commit: 'HEAD',
      path: 'apps/docs/content/next/luhn/index.mdx',
    });
  });
});

describe('the time a page shows', () => {
  it('differs between two written pages last changed by different commits', async () => {
    const { root } = repository([
      {
        files: {
          'apps/docs/content/next/urn/index.mdx': '# One\n',
          'apps/docs/content/next/urn/api.mdx': '# Api\n',
        },
      },
      { files: { 'apps/docs/content/next/urn/api.mdx': '# Api, edited\n' } },
    ]);
    const roots = siteIn(root, {});

    expect(
      await pageTime(roots, join(root, 'apps/docs/content/next/urn/index.mdx')),
    ).toBe(at(0));
    expect(
      await pageTime(roots, join(root, 'apps/docs/content/next/urn/api.mdx')),
    ).toBe(at(1));
  });

  /**
   * The bare path's page sits where the section's pages were written before
   * `content/next/` existed, so that path's own history ends at the move.
   */
  it("dates a cut page by its source at the cut, not by its path's history", async () => {
    const { root, shas } = repository([
      { files: { 'apps/docs/content/urn/api.mdx': '# Api\n' } },
      { files: { 'apps/docs/content/urn/api.mdx': '# Api, two\n' } },
      { files: { 'libs/urn/index.ts': '' } },
      {
        files: { 'apps/docs/content/next/urn/api.mdx': '# Api, two\n' },
        remove: ['apps/docs/content/urn/api.mdx'],
      },
    ]);
    const roots = siteIn(root, {
      urn: {
        current: { from: 'cut', sha: shas[2], dir: 'apps/docs/content/urn' },
        lines: [],
      },
    });

    expect(
      await pageTime(roots, join(root, 'apps/docs/content/urn/api.mdx')),
    ).toBe(at(1));
  });

  it('gives a page no commit holds no time', async () => {
    const { root } = repository([
      { files: { 'apps/docs/content/next/urn/index.mdx': '# One\n' } },
    ]);
    const roots = siteIn(root, {});

    expect(
      await pageTime(roots, join(root, 'apps/docs/content/next/urn/new.mdx')),
    ).toBeNull();
  });
});
