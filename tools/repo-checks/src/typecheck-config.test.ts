import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { globSync } from 'tinyglobby';
import { describe, expect, it } from 'vitest';

/**
 * A library that holds `*.test-d.*` files enables Vitest's `typecheck`.
 *
 * `expectTypeOf` has no runtime footprint. A type test with no `typecheck`
 * block is never compiled and never collected, so every assertion in it passes
 * whatever it asserts and the file's own suite cannot tell the difference: the
 * count of collected tests drops and nothing else changes. No type test can
 * guard this for itself, which is why the guard sits here.
 *
 * The configuration is read as text, the way `coverage-config.test.ts` reads
 * the `reportsDirectory` literal. Loading a Vite config needs Vite's config
 * loader and a plugin resolution per package, which is a large apparatus for an
 * assertion about a literal that is in the file either way.
 */

/** `typecheck: { ... enabled: true` inside one object literal. */
const ENABLED = /typecheck:\s*\{[^}]*\benabled:\s*true\b/;

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

function typeTests(root: string): string[] {
  return globSync(['**/*.test-d.{ts,tsx,mts,cts}'], {
    cwd: join(workspaceRoot, root),
    ignore: ['**/node_modules/**', '**/dist/**'],
  });
}

describe('a library that holds type tests', () => {
  it('enables the vitest typecheck run', async () => {
    const projects = await released;

    expect(projects.length).toBeGreaterThan(0);

    const withTypeTests = projects.filter(
      (project) => typeTests(project.root).length > 0,
    );

    expect(withTypeTests.length).toBeGreaterThan(0);

    const unchecked = withTypeTests
      .filter((project) => {
        const config = readFileSync(
          join(workspaceRoot, project.root, 'vite.config.ts'),
          'utf8',
        );

        return !ENABLED.test(config);
      })
      .map((project) => project.name);

    expect(
      unchecked.sort(),
      'Each of these holds *.test-d.* files and needs a test.typecheck block ' +
        'with enabled: true. Without one vitest never compiles those files ' +
        'and every expectTypeOf assertion in them passes whatever it asserts.',
    ).toEqual([]);
  });
});
