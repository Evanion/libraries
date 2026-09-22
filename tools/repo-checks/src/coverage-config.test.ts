import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { describe, expect, it } from 'vitest';

/**
 * Every released library writes its coverage to the same place.
 *
 * `/coverage` in `.gitignore` is anchored at the repository root, and the
 * comment above it states the assumption that makes the anchor safe: every
 * project writes to its own `<project>/test-output/vitest/coverage`. One
 * package had no `coverage` block at all, so Vitest's default
 * `reportsDirectory` applied and a run left `libs/astro-widget/coverage/`
 * untracked in `git status`.
 *
 * It also protects the data step behind `/testing`
 * (`apps/docs/tools/test-statistics.mjs`), which reads each library's summary
 * from that path. A library writing somewhere else fails the docs build with a
 * missing report rather than with the reason.
 *
 * The configuration is read as text. Loading eleven Vite configs needs Vite's
 * config loader, a plugin resolution per package and an Astro plugin for one of
 * them, which is a large apparatus for a three-line assertion about a literal
 * that is in the file either way.
 */

const REPORTS_DIRECTORY = "reportsDirectory: './test-output/vitest/coverage'";

/** The libraries `nx release` versions, resolved the way `nx.json` states it. */
const released = (async () => {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  if (!patterns) throw new Error('nx.json must define release.projects');

  const graph = await createProjectGraphAsync({ exitOnError: false });

  return findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    graph.nodes,
  ).map((name) => ({ name, root: graph.nodes[name]?.data.root ?? '' }));
})();

describe('a library coverage configuration', () => {
  it('writes its report where the repository ignores it', async () => {
    const projects = await released;

    expect(projects.length).toBeGreaterThan(0);

    const wrong = projects
      .filter((project) => {
        const config = readFileSync(
          join(workspaceRoot, project.root, 'vite.config.ts'),
          'utf8',
        );

        return !config.includes(REPORTS_DIRECTORY);
      })
      .map((project) => project.name);

    expect(
      wrong.sort(),
      `Each of these needs a test.coverage block with ${REPORTS_DIRECTORY}. ` +
        'Without it Vitest writes to <project>/coverage, which .gitignore does ' +
        'not reach and which the /testing data step does not read.',
    ).toEqual([]);
  });
});
