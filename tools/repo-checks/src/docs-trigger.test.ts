import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { uncoveredRoots } from './docs-trigger';

/**
 * The invariant: a change to a released package rebuilds the docs site.
 *
 * `.github/workflows/docs.yml` filters its push trigger by path, and the list is
 * written by hand. A released package under a directory the filter does not name
 * deploys nothing on release, and nothing goes red either: a push that matches no
 * path filter starts no run, so the evidence is a workflow run that does not
 * exist, which no check can look at after the fact and nobody notices in a list.
 *
 * That is the same silent shape as the undocumented packages
 * `docs-navigation.test.ts` exists for, and it takes the same answer: the
 * hand-written list is held against the thing it is supposed to track. Here that
 * is two things read through the project graph: `release.projects` in `nx.json`,
 * and what the `docs` project is built from. A project landing under a directory
 * the filter does not name fails here before it can ship a silent deploy.
 *
 * `docs.yml` is the only workflow in the repository with a path filter. `ci.yml`
 * runs on every push and pull request, and `release.yml` is `workflow_dispatch`
 * only, so neither can skip on a path.
 */

const workflow = join(workspaceRoot, '.github', 'workflows', 'docs.yml');

/** The `paths` filter on the docs workflow's push trigger. */
function docsPushPaths(): readonly string[] {
  const parsed = parse(readFileSync(workflow, 'utf-8')) as {
    // `on` is the YAML 1.1 boolean `true`, which is why the key is quoted at
    // every read of a workflow file. `yaml` parses as 1.2 and keeps the string,
    // so both spellings are accepted rather than guessing which one landed.
    on?: { push?: { paths?: unknown } };
    true?: { push?: { paths?: unknown } };
  };
  const paths = (parsed.on ?? parsed.true)?.push?.paths;

  if (!Array.isArray(paths))
    throw new Error(`${workflow} has no push paths filter to check`);

  return paths as readonly string[];
}

/**
 * The roots of the projects `nx release` versions, which is what "a released
 * package" means here. Read from `nx.json` through the graph rather than
 * restated, so a new package is picked up without editing this file.
 */
const graph = createProjectGraphAsync({ exitOnError: false });

async function rootsOf(names: readonly string[]): Promise<string[]> {
  const nodes = (await graph).nodes;

  return names.map((name) => {
    const node = nodes[name];
    if (!node) throw new Error(`${name} is not a project in the graph`);
    return node.data.root;
  });
}

const releasedRoots: Promise<string[]> = (async () => {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  if (!patterns) throw new Error('nx.json must define release.projects');

  const names = findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    (await graph).nodes,
  );

  if (names.length === 0)
    throw new Error('release.projects matched no projects');

  return rootsOf(names);
})();

/**
 * The roots of the in-workspace projects the docs site is built from, itself
 * included. `@evanion/baize-ui` is one and is released by nothing, so the
 * released set does not reach it, and a filter covering only released packages
 * would deploy no rebuild when the design system the pages render in changes.
 */
const docsBuildRoots: Promise<string[]> = (async () => {
  const dependencies = (await graph).dependencies['docs'];

  if (!dependencies) throw new Error('docs is not a project in the graph');

  const inWorkspace = dependencies
    .map((dependency) => dependency.target)
    .filter((target) => !target.startsWith('npm:'));

  return rootsOf(['docs', ...new Set(inWorkspace)]);
})();

describe('the docs workflow path filter', () => {
  it('covers every released package', async () => {
    expect(
      uncoveredRoots({ roots: await releasedRoots, patterns: docsPushPaths() }),
    ).toEqual([]);
  });

  /**
   * The filter is what makes the site rebuild; the site and what it is built
   * from are what make the rebuild worth running. A filter that named the
   * released packages but not `apps/docs/**` would pass the assertion above and
   * still not deploy a change to a page.
   */
  it('covers the site and what it is built from', async () => {
    expect(
      uncoveredRoots({
        roots: await docsBuildRoots,
        patterns: docsPushPaths(),
      }),
    ).toEqual([]);
  });
});

describe('an uncovered root', () => {
  const patterns = ['apps/docs/**', 'libs/**', 'server/**', 'package.json'];

  it('is reported when no pattern names its directory', () => {
    expect(
      uncoveredRoots({ roots: ['libs/luhn', 'worker/queue'], patterns }),
    ).toEqual(['worker/queue']);
  });

  it('is not reported when a pattern spans its subtree', () => {
    expect(uncoveredRoots({ roots: ['server/gateway'], patterns })).toEqual([]);
  });

  /** The shape that ships a release with no deploy: the root's directory unnamed. */
  it('is reported when the directory it sits under is missing', () => {
    expect(
      uncoveredRoots({
        roots: ['libs/luhn', 'server/gateway'],
        patterns: ['apps/docs/**', 'libs/**', 'package.json'],
      }),
    ).toEqual(['server/gateway']);
  });

  /** `libs` and `libs-extra` share a prefix and not a directory. */
  it('is reported when a pattern only shares a name prefix', () => {
    expect(uncoveredRoots({ roots: ['libs-extra/thing'], patterns })).toEqual([
      'libs-extra/thing',
    ]);
  });

  it('is not reported when its own directory is named exactly', () => {
    expect(
      uncoveredRoots({
        roots: ['server/gateway'],
        patterns: ['server/gateway/**'],
      }),
    ).toEqual([]);
  });

  it('is not reported under a repository-wide pattern', () => {
    expect(uncoveredRoots({ roots: ['server/x'], patterns: ['**'] })).toEqual(
      [],
    );
  });

  it('reports every uncovered root, sorted', () => {
    expect(
      uncoveredRoots({
        roots: ['tools/b', 'worker/a', 'libs/luhn'],
        patterns,
      }),
    ).toEqual(['tools/b', 'worker/a']);
  });
});

/**
 * A pattern the rule cannot read as a whole subtree contributes no coverage.
 * Erring this way is the point: a false report is a red check somebody reads,
 * where a false pass is another silent deploy that never happened.
 */
describe('a pattern that is not a whole subtree', () => {
  it('does not cover a root when it stops at one segment', () => {
    expect(
      uncoveredRoots({ roots: ['server/gateway'], patterns: ['server/*'] }),
    ).toEqual(['server/gateway']);
  });

  it('does not cover a root when it names a file', () => {
    expect(
      uncoveredRoots({
        roots: ['server/gateway'],
        patterns: ['server/gateway/package.json'],
      }),
    ).toEqual(['server/gateway']);
  });

  it('does not cover a root when a glob sits inside its prefix', () => {
    expect(
      uncoveredRoots({
        roots: ['server/gateway'],
        patterns: ['server/*/src/**'],
      }),
    ).toEqual(['server/gateway']);
  });
});

/**
 * A negation anywhere inside a root uncovers it. Whether the hole it cuts
 * matters is a judgement, and for a deploy trigger the answer is always yes, so
 * the rule does not try to make it.
 */
describe('a negated pattern', () => {
  it('uncovers a root it excludes outright', () => {
    expect(
      uncoveredRoots({
        roots: ['libs/luhn'],
        patterns: ['libs/**', '!libs/luhn/**'],
      }),
    ).toEqual(['libs/luhn']);
  });

  it('uncovers a root it excludes part of', () => {
    expect(
      uncoveredRoots({
        roots: ['libs/luhn'],
        patterns: ['libs/**', '!libs/luhn/src/generated/**'],
      }),
    ).toEqual(['libs/luhn']);
  });

  it('uncovers a root inside the directory it excludes', () => {
    expect(
      uncoveredRoots({ roots: ['libs/luhn'], patterns: ['**', '!libs/**'] }),
    ).toEqual(['libs/luhn']);
  });

  it('leaves a root it does not touch alone', () => {
    expect(
      uncoveredRoots({
        roots: ['libs/luhn'],
        patterns: ['libs/**', '!libs/compose/**'],
      }),
    ).toEqual([]);
  });
});
