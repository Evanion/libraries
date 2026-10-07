import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createProjectFileMapUsingProjectGraph,
  createProjectGraphAsync,
  parseJson,
  workspaceRoot,
  type NxJsonConfiguration,
  type ProjectGraph,
} from '@nx/devkit';
import { createNxReleaseConfig } from 'nx/src/command-line/release/config/config';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { afterAll, describe, expect, it } from 'vitest';

import {
  bumpingTypes,
  committedMessage,
  projectsOf,
  rangeCommits,
  stagedCommit,
  toolingProjects,
  violations,
  type Commit,
  type Workspace,
} from './tooling-commit-types.js';

/**
 * The rule in tooling-commit-types.ts, against fixture graphs and fixture
 * repositories, and the two pieces of it that read this repository: the
 * tooling set and the bumping types.
 */

function nxJson(): NxJsonConfiguration {
  return parseJson(readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'), {
    expectComments: true,
  });
}

/** A graph of `roots`, with project-to-project `edges`. */
function graph(
  roots: Record<string, string>,
  edges: Record<string, string[]> = {},
): Pick<ProjectGraph, 'nodes' | 'dependencies'> {
  return {
    nodes: Object.fromEntries(
      Object.entries(roots).map(([name, root]) => [
        name,
        { name, type: 'lib' as const, data: { root } },
      ]),
    ),
    dependencies: Object.fromEntries(
      Object.entries(edges).map(([source, targets]) => [
        source,
        targets.map((target) => ({ source, target, type: 'static' })),
      ]),
    ),
  };
}

describe('the tooling a library depends on', () => {
  it('is a project outside the libraries that a library depends on', () => {
    const fixture = graph(
      { lib: 'libs/lib', examples: 'tools/examples', app: 'apps/app' },
      { lib: ['examples'], app: ['lib'] },
    );

    expect(toolingProjects(fixture, new Set(['lib']))).toEqual(
      new Set(['examples']),
    );
  });

  it('follows the graph through another library and another tool', () => {
    const fixture = graph(
      {
        core: 'libs/core',
        react: 'libs/react',
        examples: 'tools/examples',
        preamble: 'tools/preamble',
      },
      { react: ['core'], core: ['examples'], examples: ['preamble'] },
    );

    expect(toolingProjects(fixture, new Set(['core', 'react']))).toEqual(
      new Set(['examples', 'preamble']),
    );
  });

  it('leaves out a project only an app depends on', () => {
    const fixture = graph(
      { lib: 'libs/lib', ui: 'internal/ui', app: 'apps/app' },
      { app: ['lib', 'ui'] },
    );

    expect(toolingProjects(fixture, new Set(['lib']))).toEqual(new Set());
  });

  it('leaves out an edge to an npm package', () => {
    const fixture = graph({ lib: 'libs/lib' }, { lib: ['npm:react'] });

    expect(toolingProjects(fixture, new Set(['lib']))).toEqual(new Set());
  });

  it('holds @evanion/doc-examples in this repository, and no library', async () => {
    const real = await createProjectGraphAsync({ exitOnError: false });
    const patterns = nxJson().release?.projects ?? [];
    const libraries = new Set(
      findMatchingProjects(
        Array.isArray(patterns) ? patterns : [patterns],
        real.nodes,
      ),
    );
    const tooling = toolingProjects(real, libraries);

    expect(tooling).toContain('@evanion/doc-examples');
    expect([...tooling].filter((name) => libraries.has(name))).toEqual([]);
  });
});

describe('the bumping types', () => {
  /**
   * `bumpingTypes` resolves the config without the graph, so it is held
   * against the resolution `nx release` itself runs.
   */
  it('are the types nx release resolves to a bump', async () => {
    const real = await createProjectGraphAsync({ exitOnError: false });
    const release = nxJson().release;
    const { error, nxReleaseConfig } = await createNxReleaseConfig(
      real,
      await createProjectFileMapUsingProjectGraph(real),
      release,
    );
    expect(error).toBeNull();

    const types: Record<string, { semverBump: string }> =
      nxReleaseConfig?.conventionalCommits.types ?? {};
    const resolved = Object.entries(types)
      .filter(([, type]) => type.semverBump !== 'none')
      .map(([name]) => name)
      .sort();

    expect([...bumpingTypes(release?.conventionalCommits)].sort()).toEqual(
      resolved,
    );
  });

  it('are feat and fix by nx default', () => {
    expect([...bumpingTypes(undefined)].sort()).toEqual(['feat', 'fix']);
  });

  it('follow a type the config turns off or on', () => {
    expect(
      bumpingTypes({ types: { fix: false, docs: { semverBump: 'patch' } } }),
    ).toEqual(new Set(['feat', 'docs']));
  });
});

describe('the commit-msg file', () => {
  it('drops comment lines and everything below the scissors', () => {
    const raw = [
      'fix(repo): a subject',
      '',
      'A body.',
      '# Please enter the commit message',
      '# ------------------------ >8 ------------------------',
      'diff --git a/x b/x',
    ].join('\n');

    expect(committedMessage(raw)).toBe('fix(repo): a subject\n\nA body.');
  });
});

/**
 * A workspace shaped like this one: a library, the tooling it depends on, a
 * repo-check project that depends on both, and an app.
 */
const workspace: Workspace = {
  bumps: new Set(['feat', 'fix']),
  projects: async () =>
    projectsOf(
      graph(
        {
          lib: 'libs/lib',
          examples: 'tools/examples',
          checks: 'tools/checks',
          app: 'apps/app',
        },
        { lib: ['examples'], checks: ['lib', 'examples'], app: ['lib'] },
      ),
      new Set(['lib']),
    ),
};

const files = {
  library: 'libs/lib/src/index.ts',
  tooling: 'tools/examples/src/fence.mjs',
  check: 'tools/checks/src/fence.test.ts',
  app: 'apps/app/src/page.tsx',
  root: 'package-lock.json',
};

describe('the rule', () => {
  const fixtures: string[] = [];

  afterAll(() => {
    for (const root of fixtures) rmSync(root, { recursive: true, force: true });
  });

  /** A repository with every file in `files` committed on `main`. */
  function repository(): string {
    const root = mkdtempSync(join(tmpdir(), 'tooling-commit-types-'));
    fixtures.push(root);

    git(root, 'init', '--initial-branch=main');
    git(root, 'config', 'user.email', 'fixture@example.com');
    git(root, 'config', 'user.name', 'Fixture');
    // A signing key the runner does not have fails the commit, and the
    // developer running this may have commit.gpgsign on globally.
    git(root, 'config', 'commit.gpgsign', 'false');

    for (const path of Object.values(files)) write(root, path, 'a\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'chore: fixture');

    return root;
  }

  function git(root: string, ...args: string[]) {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  }

  function write(root: string, path: string, contents: string) {
    const file = join(root, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents);
  }

  /** Stages a change to `paths` and reads it as the commit-msg hook does. */
  function staged(message: string, paths: string[]): Commit {
    const root = repository();
    for (const path of paths) write(root, path, 'b\n');
    git(root, 'add', '-A');

    const messageFile = join(root, '.git', 'COMMIT_EDITMSG');
    writeFileSync(messageFile, `${message}\n# Please enter the message\n`);

    return stagedCommit(root, messageFile);
  }

  async function rejected(message: string, paths: string[]) {
    const found = await violations([staged(message, paths)], workspace);
    return found.map((violation) => violation.files);
  }

  it('rejects a fix that changes only tooling a library depends on', async () => {
    expect(await rejected('fix(repo): cut the fence', [files.tooling])).toEqual(
      [[files.tooling]],
    );
  });

  it('rejects a feat that changes only tooling a library depends on', async () => {
    expect(await rejected('feat(repo): add a fence', [files.tooling])).toEqual([
      [files.tooling],
    ]);
  });

  /** nx still patches every library: the tooling edge is what reaches them. */
  it('rejects a fix to tooling that also changes a non-library project', async () => {
    expect(
      await rejected('fix(repo): cut the fence', [files.tooling, files.check]),
    ).toEqual([[files.tooling]]);
  });

  it('rejects a fix that changes only files no project owns', async () => {
    expect(await rejected('fix(repo): pin a dependency', [files.root])).toEqual(
      [[files.root]],
    );
  });

  it('allows a fix that changes tooling and a library', async () => {
    expect(
      await rejected('fix(lib): cut the fence', [files.tooling, files.library]),
    ).toEqual([]);
  });

  it('allows a feat to an app that also changes files no project owns', async () => {
    expect(
      await rejected('feat(app): add a page', [files.app, files.root]),
    ).toEqual([]);
  });

  for (const type of ['build', 'test', 'docs']) {
    it(`allows ${type} on tooling`, async () => {
      expect(
        await rejected(`${type}(repo): cut the fence`, [files.tooling]),
      ).toEqual([]);
    });
  }

  it('allows a breaking fix on tooling', async () => {
    expect(
      await rejected('fix(repo)!: drop the fence', [files.tooling]),
    ).toEqual([]);
  });

  it('allows a fix on tooling with a BREAKING CHANGE footer', async () => {
    expect(
      await rejected('fix(repo): drop the fence\n\nBREAKING CHANGE: no fence', [
        files.tooling,
      ]),
    ).toEqual([]);
  });

  it('builds no graph for a commit whose type bumps nothing', async () => {
    const found = await violations([staged('docs(repo): x', [files.tooling])], {
      bumps: workspace.bumps,
      projects: () => {
        throw new Error('the graph was built');
      },
    });

    expect(found).toEqual([]);
  });

  /** What CI runs: every commit on the branch, by its own files. */
  it('names the commit in a branch that changes only tooling', async () => {
    const root = repository();
    git(root, 'checkout', '-b', 'branch');

    write(root, files.library, 'b\n');
    write(root, files.tooling, 'b\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'fix(lib): cut the fence');

    write(root, files.tooling, 'c\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'fix(repo): cut the fence again');

    write(root, files.tooling, 'd\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'test(repo): cover the fence');

    const found = await violations(rangeCommits(root, 'main..HEAD'), workspace);

    expect(
      found.map(({ commit, files: named }) => [commit.message, named]),
    ).toEqual([['fix(repo): cut the fence again', [files.tooling]]]);
  });
});
