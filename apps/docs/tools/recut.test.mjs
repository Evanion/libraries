import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { gitAt } from './archives.mjs';
import { recutBody, recutPin } from './recut.mjs';

/**
 * The invariant: a re-cut opens a pull request only for a version that was
 * released, from a commit on `main` past its tag that `nx release` still
 * versions as that release, and says why.
 *
 * Against a fixture repository whose history each case needs.
 */

const fixtures = [];

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

/** main: tag, a docs fix, a code fix; and a side branch off the tag. */
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'docs-recut-'));
  fixtures.push(root);

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const commit = (path, contents, message) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
    git('add', '-A');
    git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };

  git('init', '--initial-branch=main');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');

  const tagged = commit(
    'apps/docs/content/next/luhn/index.mdx',
    '# Luhn\n\nTeh check.\n',
    'release',
  );
  git('tag', '@evanion/luhn@3.0.0');
  const typo = commit(
    'apps/docs/content/next/luhn/index.mdx',
    '# Luhn\n\nThe check.\n',
    'docs: typo',
  );
  const fix = commit('libs/luhn/index.ts', 'fixed\n', 'fix: bug');
  git('checkout', '-b', 'side', tagged);
  const side = commit('side.txt', 'x\n', 'side');
  git('checkout', 'main');

  return { root, tagged, typo, fix, side };
}

const entry = {
  name: '@evanion/luhn',
  slug: 'luhn',
  documented: true,
  workshop: false,
};

function request(fixture, overrides = {}) {
  const git = gitAt(fixture.root);

  return recutPin({
    pins: {},
    entry,
    tags: git.tags(),
    segment: 'v3',
    sha: fixture.typo,
    reason: 'fixes a typo the release shipped',
    git,
    main: git.commit('main'),
    computed: () => null,
    ...overrides,
  });
}

describe('a re-cut', () => {
  it('pins the release to the commit with its reason, from its tag', () => {
    const fixture = repository();

    expect(request(fixture)).toEqual({
      release: { tag: '@evanion/luhn@3.0.0', version: '3.0.0' },
      from: fixture.tagged,
      pin: {
        version: '3.0.0',
        tag: '@evanion/luhn@3.0.0',
        sha: fixture.typo,
        reason: 'fixes a typo the release shipped',
      },
    });
  });

  it('refuses a commit the repository does not have', () => {
    expect(() =>
      request(repository(), {
        sha: '0123456789abcdef0123456789abcdef01234567',
      }),
    ).toThrow(/not a commit in this repository/);
  });

  it('refuses a commit that is not on main', () => {
    const fixture = repository();

    expect(() => request(fixture, { sha: fixture.side })).toThrow(
      /not on main/,
    );
  });

  it("refuses a commit past a later release's tag", () => {
    const fixture = repository();
    execFileSync('git', ['tag', '@evanion/luhn@4.0.0', fixture.fix], {
      cwd: fixture.root,
    });

    expect(() => request(fixture, { sha: fixture.fix })).toThrow(
      /carries @evanion\/luhn@4\.0\.0, so it is not documentation of 3\.0\.0/,
    );
  });

  it('refuses a line that was never released', () => {
    expect(() => request(repository(), { segment: 'v4' })).toThrow(
      /released nothing in the line v4/,
    );
  });

  it('refuses a commit nx release would version as another release', () => {
    const fixture = repository();

    expect(() =>
      request(fixture, { sha: fixture.fix, computed: () => '3.0.1' }),
    ).toThrow(/computes 3\.0\.1, so it is not documentation of 3\.0\.0/);
  });

  it('refuses a reason another pin already gives', () => {
    expect(() =>
      request(repository(), {
        pins: {
          urn: {
            v2: {
              version: '2.0.0',
              tag: '@evanion/urn@2.0.0',
              next: true,
              reason: 'fixes a typo the release shipped',
            },
          },
        },
      }),
    ).toThrow(/urn\.v2 already gives that reason/);
  });

  it('puts the change to the pages in the pull request', () => {
    const fixture = repository();
    const recut = request(fixture);
    const diff = execFileSync(
      'git',
      ['diff', recut.from, recut.pin.sha, '--', 'apps/docs/content/'],
      { cwd: fixture.root, encoding: 'utf8' },
    );

    const body = recutBody({ entry, segment: 'v3', ...recut, diff });

    expect(body).toContain('Reason: fixes a typo the release shipped');
    expect(body).toContain('-Teh check.');
    expect(body).toContain('+The check.');
  });
});
