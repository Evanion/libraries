import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `nx release` resolves conventional-commit scopes against Nx PROJECT NAMES
 * (getCommitsRelevantToProjects in
 * nx/src/command-line/release/utils/shared.js). A scope that matches no
 * project is not an error -- semver.js downgrades the commit to a `patch`
 * bump. That is how `feat(widget)!:` on `@evanion/react-widget` resolved as
 * 0.1.1 instead of 0.2.0.
 *
 * commitlint's `scope-enum` is therefore the guardrail, and it has to be a
 * static list: it runs in the commit-msg hook on every commit and cannot
 * afford a project-graph computation. Static list, dynamic test -- this is the
 * test. It fails the build when a releasable project is added without the
 * matching scope.
 */

const require_ = createRequire(import.meta.url);

interface CommitlintConfig {
  rules: Record<string, unknown>;
}

function readScopeEnum(): string[] {
  const config = require_(
    join(workspaceRoot, 'commitlint.config.js'),
  ) as CommitlintConfig;
  const rule = config.rules['scope-enum'];

  expect(
    rule,
    'commitlint.config.js must define a scope-enum rule',
  ).toBeDefined();

  const [level, applicable, scopes] = rule as [number, string, string[]];
  expect(level, 'scope-enum must be an error, not a warning').toBe(2);
  expect(applicable).toBe('always');
  expect(Array.isArray(scopes)).toBe(true);

  return scopes;
}

/** nx.json carries `//` comments, so it needs the JSONC fallback Nx itself uses. */
function readReleaseProjectPatterns(): string[] {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  expect(patterns, 'nx.json must define release.projects').toBeDefined();

  return Array.isArray(patterns) ? patterns : [patterns as string];
}

/** `@evanion/react-widget` -> `react-widget`. This is what Nx matches a scope against. */
function bareName(projectName: string): string {
  return projectName.replace(/^@[^/]+\//, '');
}

describe('commitlint scope-enum', () => {
  it('covers every project nx.json releases', async () => {
    const projectGraph = await createProjectGraphAsync({ exitOnError: false });
    const releaseProjects = findMatchingProjects(
      readReleaseProjectPatterns(),
      projectGraph.nodes,
    );

    expect(
      releaseProjects.length,
      'release.projects matched no projects -- the globs or the graph are wrong',
    ).toBeGreaterThan(0);

    const scopes = readScopeEnum();
    const missing = releaseProjects
      .map(bareName)
      .filter((name) => !scopes.includes(name))
      .sort();

    expect(
      missing,
      `Add these to 'scope-enum' in commitlint.config.js and to the Scopes ` +
        `section of CONTRIBUTING.md. A releasable project with no matching ` +
        `scope gets patch-bumped instead of erroring.`,
    ).toEqual([]);
  });

  it('has no duplicate entries', () => {
    const scopes = readScopeEnum();
    expect(scopes).toEqual([...new Set(scopes)]);
  });

  it('lists no scope carrying the @evanion/ prefix', () => {
    // A scope of `@evanion/react-widget` would not survive the bare-name
    // matching Nx does, so reject the prefixed form outright.
    expect(readScopeEnum().filter((scope) => scope.includes('/'))).toEqual([]);
  });
});
