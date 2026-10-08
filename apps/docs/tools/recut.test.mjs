import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { gitAt } from './archives.mjs';
import { recutBody, recutPin } from './recut.mjs';

/**
 * The invariant: a re-cut opens a pull request only for a line's x.y.0
 * release, from a commit on `main` past its tag that `nx release` still
 * versions as that x.y, and says why.
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
    computed: () => ({ version: null, counted: [] }),
    ...overrides,
  });
}

describe('a re-cut', () => {
  it('pins the release to the commit with its reason, from its tag', () => {
    const fixture = repository();

    expect(request(fixture)).toEqual({
      release: { tag: '@evanion/luhn@3.0.0', version: '3.0.0' },
      from: fixture.tagged,
      ignored: [],
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

  /**
   * A documentation fix made after 3.0.1 is a re-cut of 3.0.0, which 3.0.1 is
   * documented by, from a commit that carries the patch's tag.
   */
  it("re-cuts a line's x.y.0 from a commit past a patch release of it", () => {
    const fixture = repository();
    execFileSync('git', ['tag', '@evanion/luhn@3.0.1', fixture.typo], {
      cwd: fixture.root,
    });

    expect(request(fixture).pin).toEqual({
      version: '3.0.0',
      tag: '@evanion/luhn@3.0.0',
      sha: fixture.typo,
      reason: 'fixes a typo the release shipped',
    });
  });

  it('refuses a line that was never released', () => {
    expect(() => request(repository(), { segment: 'v4' })).toThrow(
      /released nothing in the line v4/,
    );
  });

  it('refuses a commit nx release would version as another release', () => {
    const fixture = repository();

    expect(() =>
      request(fixture, {
        sha: fixture.fix,
        computed: () => ({ version: '3.0.1', counted: [] }),
      }),
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

/**
 * The rule the commit-msg hook holds new commits to, imported by file URL as
 * `tools/repo-checks` imports this app's modules: a path import across the
 * project boundary is one `@nx/enforce-module-boundaries` refuses.
 */
const toolingCommitTypes = () =>
  import(
    pathToFileURL(
      join(
        import.meta.dirname,
        '../../../tools/repo-checks/src/tooling-commit-types.ts',
      ),
    ).href
  );

/** A library and the tooling it depends on, as in this repository. */
const roots = {
  '@evanion/luhn': 'libs/luhn',
  '@evanion/doc-examples': 'tools/doc-examples',
};

const files = {
  library: 'libs/luhn/src/index.ts',
  tooling: 'tools/doc-examples/src/md-siblings.mjs',
};

/**
 * What nx counts a commit toward: the projects owning its files and every
 * project depending on one, or every project for a file no project owns.
 */
async function affected(commit) {
  const owners = commit.files.map(
    (file) =>
      Object.keys(roots).find((name) => file.startsWith(`${roots[name]}/`)) ??
      null,
  );
  if (owners.includes(null)) return new Set(Object.keys(roots));

  const hit = new Set(owners);
  if (hit.has('@evanion/doc-examples')) hit.add('@evanion/luhn');
  return hit;
}

/**
 * The dry run's answer at `sha` in a fixture: a patch, with the commits since
 * the tag as the shared rule reads them.
 */
async function patchedAt(root, sha) {
  const { countedCommits, projectsOf, rangeCommits } =
    await toolingCommitTypes();
  const workspace = {
    bumps: new Set(['feat', 'fix']),
    projects: async () =>
      projectsOf(
        {
          nodes: Object.fromEntries(
            Object.entries(roots).map(([name, root]) => [
              name,
              { name, type: 'lib', data: { root } },
            ]),
          ),
          dependencies: {
            '@evanion/luhn': [
              {
                source: '@evanion/luhn',
                target: '@evanion/doc-examples',
                type: 'static',
              },
            ],
          },
        },
        new Set(['@evanion/luhn']),
      ),
  };
  const counted = await countedCommits(
    rangeCommits(root, `@evanion/luhn@3.0.0..${sha}`),
    '@evanion/luhn',
    workspace,
    affected,
  );

  return {
    version: '3.0.1',
    counted: counted.map(({ commit, tooling }) => ({
      sha: commit.sha,
      header: commit.message.split('\n')[0],
      tooling,
    })),
  };
}

/** main: the tag, then one commit per entry of `changes`. */
function history(changes) {
  const root = mkdtempSync(join(tmpdir(), 'docs-recut-tooling-'));
  fixtures.push(root);

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const write = (path, contents) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  };

  git('init', '--initial-branch=main');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');

  for (const path of Object.values(files)) write(path, 'a\n');
  git('add', '-A');
  git('commit', '-m', 'release');
  git('tag', '@evanion/luhn@3.0.0');

  const shas = changes.map(({ message, paths }, at) => {
    for (const path of paths) write(path, `${at}\n`);
    git('add', '-A');
    git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  });

  return { root, shas, head: shas.at(-1) };
}

describe('a re-cut past a computed change', () => {
  const toolingFix = {
    message: "fix(docs): cut an .md sibling's fence at its last marker",
    paths: [files.tooling],
  };
  const libraryFix = {
    message: 'fix(luhn): reject an empty number',
    paths: [files.library],
  };

  async function attempt(changes) {
    const fixture = history(changes);
    const computed = await patchedAt(fixture.root, fixture.head);

    return {
      fixture,
      recut: () =>
        request(fixture, {
          sha: fixture.head,
          computed: () => computed,
          reason: 'shows the twoslash fences the release cut short',
        }),
    };
  }

  it('re-cuts when every counted commit changes only tooling, and names them', async () => {
    const { fixture, recut } = await attempt([toolingFix]);

    expect(recut().ignored).toEqual([
      { sha: fixture.shas[0], header: toolingFix.message, tooling: true },
    ]);
  });

  it('refuses a fix to the library', async () => {
    const { recut } = await attempt([libraryFix]);

    expect(recut).toThrow(
      /computes 3\.0\.1, so it is not documentation of 3\.0\.0\n {2}\w{8} fix\(luhn\): reject an empty number$/,
    );
  });

  it('refuses a fix to the library beside a fix to tooling, naming the library fix', async () => {
    const { recut } = await attempt([toolingFix, libraryFix]);

    expect(recut).toThrow(
      /not documentation of 3\.0\.0\n {2}\w{8} fix\(luhn\): reject an empty number$/,
    );
  });

  it('refuses a feat that changes tooling and a library file', async () => {
    const { recut } = await attempt([
      {
        message: 'feat(luhn): document the check digit',
        paths: [files.tooling, files.library],
      },
    ]);

    expect(recut).toThrow(
      /not documentation of 3\.0\.0\n {2}\w{8} feat\(luhn\): document the check digit$/,
    );
  });

  it('names the commits it did not count in the pull request', async () => {
    const { fixture, recut } = await attempt([toolingFix]);

    const body = recutBody({ entry, segment: 'v3', ...recut(), diff: '' });

    expect(body).toContain(`- ${fixture.shas[0]} ${toolingFix.message}`);
  });
});
