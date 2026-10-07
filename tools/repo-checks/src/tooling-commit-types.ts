import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createProjectGraphAsync,
  parseJson,
  workspaceRoot,
  type NxJsonConfiguration,
  type ProjectGraph,
} from '@nx/devkit';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from 'nx/src/command-line/release/config/conventional-commits';
import { parseGitCommit } from 'nx/src/command-line/release/utils/git';
import {
  createProjectRootMappings,
  findMatchingProjects,
  findProjectForPath,
} from 'nx/src/devkit-internals';

/**
 * A `feat` or `fix` commit that changes no library and changes tooling a
 * library depends on.
 *
 * `nx release` finds the projects a commit touches with the same
 * `filterAffected` that `nx affected` uses, so a change to a project reaches
 * every project that depends on it. Every library depends on
 * `@evanion/doc-examples` for its doctests, so a `fix` there reads as a patch
 * for every library, and nx 23 has no setting that drops the edge from release
 * and keeps it for affected. What nx does respect is the type: a commit whose
 * scope names a different project contributes nothing when its type bumps
 * nothing (`determineSemverChange` in nx's `semver.js`). So the type is the
 * place to hold the line.
 *
 * The rule, per commit:
 *
 * - the commit's type bumps a version in nx's resolved conventional-commits
 *   config, and it is not breaking;
 * - no file it changes belongs to a library, meaning a project nx.json's
 *   `release.projects` matches;
 * - a file it changes belongs to tooling a library depends on, or every file it
 *   changes belongs to such tooling or to no project.
 *
 * Tooling a library depends on is every project outside the libraries that a
 * library reaches through the project graph, so it follows the graph as
 * dependencies move. One such file is enough: a fix to `tools/doc-examples`
 * that also changes its repo-check test still patches every library.
 *
 * A file no project owns counts when the commit changes nothing else, because
 * nx can read a root file such as `nx.json` or `package-lock.json` as touching
 * every project. Beside an app's own files it does not count, so a `feat(docs)`
 * that adds a dependency to the docs site stays a feat.
 *
 * `.husky/commit-msg` runs this over the staged files, and `.github/workflows/
 * ci.yml` runs it over a pull request's commits. The IO is passed in so the
 * rule can be asserted against fixture repositories and fixture graphs.
 */

/** What the rule needs from the workspace, beyond the commit itself. */
export interface Workspace {
  /** Commit types whose `semverBump` is not `none`. */
  bumps: Set<string>;
  /** Builds the project side of the rule. Only a bumping commit calls it. */
  projects: () => Promise<Projects>;
}

export interface Projects {
  libraries: Set<string>;
  tooling: Set<string>;
  /** The project owning a root-relative path, or null for none. */
  owner: (path: string) => string | null;
}

export interface Commit {
  /** Empty for the commit being written. */
  sha: string;
  message: string;
  files: string[];
}

export interface Violation {
  commit: Commit;
  /** The changed files that are tooling a library depends on, or no project's. */
  files: string[];
}

/**
 * The types nx release bumps a version for.
 *
 * nx resolves `release.conventionalCommits.types` over its defaults in
 * `createNxReleaseConfig`, which needs the project graph. This repeats that
 * resolution for the `semverBump` field alone, so a commit typed `docs` or
 * `build` is decided without building the graph. `tooling-commit-types.test.ts`
 * holds the two against each other.
 */
export function bumpingTypes(
  conventionalCommits: NonNullable<
    NxJsonConfiguration['release']
  >['conventionalCommits'],
): Set<string> {
  const defaults: Record<string, { semverBump: string }> =
    DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types;
  const configured = conventionalCommits?.types ?? {};
  const bumps = new Set<string>();

  for (const type of new Set([
    ...Object.keys(defaults),
    ...Object.keys(configured),
  ])) {
    const fallback = defaults[type]?.semverBump;
    const given = configured[type];

    let bump: string | undefined;
    if (given === undefined) bump = fallback;
    else if (given === false) bump = 'none';
    else
      bump =
        (given === true ? undefined : given.semverBump) ||
        (fallback !== 'none' ? fallback : undefined) ||
        'patch';

    if (bump !== 'none') bumps.add(type);
  }

  return bumps;
}

/**
 * Every project outside `libraries` that a library reaches through the graph's
 * project-to-project edges. Edges to npm packages are skipped.
 */
export function toolingProjects(
  graph: Pick<ProjectGraph, 'nodes' | 'dependencies'>,
  libraries: Set<string>,
): Set<string> {
  const reached = new Set(libraries);
  const queue = [...libraries];

  while (queue.length > 0) {
    const source = queue.pop() as string;
    for (const { target } of graph.dependencies[source] ?? []) {
      if (!graph.nodes[target] || reached.has(target)) continue;
      reached.add(target);
      queue.push(target);
    }
  }

  for (const library of libraries) reached.delete(library);
  return reached;
}

/** The project side of the rule, from a graph and the library set. */
export function projectsOf(
  graph: Pick<ProjectGraph, 'nodes' | 'dependencies'>,
  libraries: Set<string>,
): Projects {
  const roots = createProjectRootMappings(graph.nodes);

  return {
    libraries,
    tooling: toolingProjects(graph, libraries),
    owner: (path) => findProjectForPath(path, roots) ?? null,
  };
}

/**
 * The message git commits, from a commit-msg file: no comment lines, nothing
 * from the `--verbose` scissors line down.
 */
export function committedMessage(raw: string): string {
  const lines: string[] = [];
  for (const line of raw.split('\n')) {
    if (/^# -+ >8 -+$/.test(line)) break;
    if (!line.startsWith('#')) lines.push(line);
  }
  return lines.join('\n').trim();
}

/** Whether nx reads `message` as bumping a version without being breaking. */
function bumpsWithoutBreaking(message: string, bumps: Set<string>): boolean {
  const [header = '', ...body] = message.split('\n');
  const commit = parseGitCommit({
    message: header,
    body: body.join('\n'),
    shortHash: '',
    author: { name: '', email: '' },
  });

  return commit !== null && bumps.has(commit.type) && !commit.isBreaking;
}

/** The commits in `commits` the rule rejects. */
export async function violations(
  commits: Commit[],
  workspace: Workspace,
): Promise<Violation[]> {
  const suspects = commits.filter((commit) =>
    bumpsWithoutBreaking(commit.message, workspace.bumps),
  );
  if (suspects.length === 0) return [];

  const { libraries, tooling, owner } = await workspace.projects();
  const found: Violation[] = [];

  for (const commit of suspects) {
    const owned = commit.files.map((file) => ({ file, project: owner(file) }));
    if (owned.some(({ project }) => project !== null && libraries.has(project)))
      continue;

    const files = owned
      .filter(({ project }) => project === null || tooling.has(project))
      .map(({ file }) => file);
    const touchesTooling = owned.some(
      ({ project }) => project !== null && tooling.has(project),
    );
    const onlyThese = files.length === commit.files.length;

    if (files.length > 0 && (touchesTooling || onlyThese))
      found.push({ commit, files });
  }

  return found;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** `-z` output as a list. `--no-renames` lists both sides of a rename. */
function paths(output: string): string[] {
  return output.split('\0').filter((path) => path !== '');
}

/** The commit being written: the staged files and the commit-msg file. */
export function stagedCommit(root: string, messageFile: string): Commit {
  return {
    sha: '',
    message: committedMessage(readFileSync(messageFile, 'utf-8')),
    files: paths(
      git(root, ['diff', '--cached', '--name-only', '-z', '--no-renames']),
    ),
  };
}

/** Every non-merge commit in `range`, oldest first. */
export function rangeCommits(root: string, range: string): Commit[] {
  const shas = git(root, ['rev-list', '--no-merges', '--reverse', range])
    .split('\n')
    .filter((sha) => sha !== '');

  return shas.map((sha) => ({
    sha,
    message: git(root, ['log', '-1', '--format=%B', sha]).trim(),
    files: paths(
      git(root, [
        'diff-tree',
        '--root',
        '--no-commit-id',
        '--name-only',
        '-r',
        '-z',
        '--no-renames',
        sha,
      ]),
    ),
  }));
}

/** This repository's workspace, with the graph built on first use. */
export function repositoryWorkspace(root = workspaceRoot): Workspace {
  const nxJson: NxJsonConfiguration = parseJson(
    readFileSync(join(root, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects ?? [];

  return {
    bumps: bumpingTypes(nxJson.release?.conventionalCommits),
    projects: async () => {
      const graph = await createProjectGraphAsync({ exitOnError: false });
      const libraries = new Set(
        findMatchingProjects(
          Array.isArray(patterns) ? patterns : [patterns],
          graph.nodes,
        ),
      );
      return projectsOf(graph, libraries);
    },
  };
}

/** The refusal, naming each commit and the files that decided it. */
export function report(found: Violation[]): string {
  const lines = [''];

  for (const { commit, files } of found) {
    const header = commit.message.split('\n')[0];
    const label = commit.sha ? `${commit.sha.slice(0, 8)} ${header}` : header;
    lines.push(
      `  ${label}`,
      '  changes no library, and changes tooling a library depends on or files no project owns:',
      ...files.map((file) => `    ${file}`),
      '',
    );
  }

  lines.push(
    '  nx release reads a feat or fix here as a patch for every library that',
    '  depends on that tooling. Type it build(repo), test(repo) or docs(repo).',
    '  A commit that also changes a library under release.projects may stay feat or fix.',
    '',
  );

  return lines.join('\n');
}

async function main(mode: string | undefined, argument: string | undefined) {
  if ((mode !== 'staged' && mode !== 'range') || !argument) {
    console.error(
      'Usage: tooling-commit-types.ts staged <commit-msg file> | range <revision range>',
    );
    return 2;
  }

  const commits =
    mode === 'staged'
      ? [stagedCommit(workspaceRoot, argument)]
      : rangeCommits(workspaceRoot, argument);
  const found = await violations(commits, repositoryWorkspace());

  if (found.length === 0) return 0;
  console.error(report(found));
  return 1;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv[2], process.argv[3]);
}
