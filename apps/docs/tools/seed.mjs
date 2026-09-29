import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Whether a release that shipped no pages may be documented by `main`'s.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 5 is the rule. A package
 * seeds -- its bare path is cut from `main` rather than from its tag -- iff
 * `nx release version --dry-run` computes the version its newest tag already
 * names, and every workspace dependency of it seeds too. The dependency clause
 * follows from `updateDependents: "always"` in `nx.json`: a package bumps when a
 * dependency does, so a seed is only honest if its dependencies are unchanged.
 *
 * The dry run is run, never reimplemented. `nx release` attributes a commit by
 * its scope, and counts it against every project `nx affected` names for it:
 * the projects whose files or dependencies it touched, and every project when
 * it edits a file every project reads, such as `nx.json`. So "commits touching
 * the package" and "commits nx counts" are different sets, and a second
 * reading of the same history would drift from the pipeline it is meant to
 * agree with.
 *
 * The answer is taken once, when a person cuts, and frozen in the pin's
 * `reason`. It is not re-asked of `main` by any check: the moment a `fix` lands
 * on a seeded package the predicate turns false, and a check asking it then
 * would fail about a cut that was right when it was made.
 */

/**
 * The version a dry run computes for one project, or `null` when it computes
 * no change.
 *
 * @param {string} output what `nx release version --dry-run` printed
 * @param {string} name the project
 */
export function dryRunVersion(output, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const bumped = output.match(
    new RegExp(`^${escaped} .*to get new version (\\S+)`, 'm'),
  );
  if (bumped) return bumped[1];

  if (new RegExp(`^${escaped} .*No changes were detected`, 'm').test(output))
    return null;

  throw new Error(`the dry run printed nothing about ${name}:\n${output}`);
}

/**
 * The pin a release that shipped no pages takes.
 *
 * A seed pins `main`'s commit and says so in its reason, which is the predicate
 * as it held when the cut was made. A package that would bump is served from
 * `/next/` under a notice until its next release, and its reason is the dry
 * run's answer.
 *
 * @param {{
 *   name: string,
 *   tag: string,
 *   version: string,
 *   main: string,
 *   computed: (name: string) => string | null,
 *   dependencies: (name: string) => readonly string[],
 * }} release
 */
export function seedPin({ name, tag, version, main, computed, dependencies }) {
  const blocking = [];
  const seen = new Set();
  const check = (each) => {
    if (seen.has(each)) return;
    seen.add(each);
    const next = computed(each);
    if (next !== null && each === name) blocking.push(`computes ${next}`);
    else if (next !== null) blocking.push(`${each} computes ${next}`);
    for (const dependency of dependencies(each)) check(dependency);
  };
  check(name);

  if (blocking.length === 0)
    return {
      version,
      tag,
      sha: main,
      reason: `seed: nx release version --dry-run computes ${version} at this SHA`,
    };

  return {
    version,
    tag,
    next: true,
    reason: `not seeded: nx release version --dry-run ${blocking.join(', ')}; ${tag} carries no pages`,
  };
}

/**
 * The version a dry run computes for a project with `root`'s tree at `sha`.
 *
 * Run in a detached worktree at that commit, sharing the workspace's installed
 * dependencies, so the tree nx reads is the pinned one and the history it
 * reads is the repository's. Every `node_modules` a project holds of its own is
 * shared too: nx loads each project's build config to compute the graph, and a
 * project that pins its own version of a tool resolves it from beside itself.
 */
export function dryRunAt(root, sha, name) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-seed-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

  rmSync(dir, { recursive: true, force: true });
  git('worktree', 'add', '--detach', dir, sha);

  try {
    const installed = [
      'node_modules',
      ...['apps', 'libs', 'internal', 'tools'].flatMap((group) =>
        existsSync(join(root, group))
          ? readdirSync(join(root, group))
              .map((project) => join(group, project, 'node_modules'))
              .filter((path) => existsSync(join(root, path)))
          : [],
      ),
    ];

    for (const path of installed)
      if (existsSync(dirname(join(dir, path))))
        symlinkSync(join(root, path), join(dir, path), 'dir');

    return dryRunVersion(
      execFileSync(
        'npx',
        ['nx', 'release', 'version', '--dry-run', `--projects=${name}`],
        {
          cwd: dir,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NX_NO_CLOUD: 'true',
            NX_DAEMON: 'false',
            NX_CACHE_DIRECTORY: join(dir, '.nx', 'cache'),
          },
        },
      ),
      name,
    );
  } finally {
    git('worktree', 'remove', '--force', dir);
  }
}
