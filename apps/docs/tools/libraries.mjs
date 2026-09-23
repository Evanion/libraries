import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createProjectGraphAsync, parseJson } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals.js';

/**
 * The libraries `nx release` versions.
 *
 * Two build steps ask this question. `test-statistics.mjs` reads the report
 * each library's own test target left behind and counts what is in it;
 * `behaviour-data.mjs` parses those suites for the sentences a reference entry
 * lists. Neither reads the other's output and the package list is the one
 * thing they share, so it is read once here.
 *
 * Resolved through the project graph against `nx.json`'s `release.projects`,
 * the way `tools/repo-checks/src/docs-navigation.test.ts` resolves it. The
 * scope is then the release predicate, so a twelfth library joins the day it is
 * released and nothing here is edited.
 */
export async function libraries(workspaceRoot) {
  const nxJson = parseJson(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;
  if (!patterns) throw new Error('nx.json must define release.projects');

  const graph = await createProjectGraphAsync({ exitOnError: false });
  const names = findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    graph.nodes,
  );

  return names
    .map((name) => ({ name, root: graph.nodes[name].data.root }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
