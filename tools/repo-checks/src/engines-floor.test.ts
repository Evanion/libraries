import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  enginesViolations,
  type Manifest,
  type Requirement,
} from './engines-floor';

/**
 * The invariant: a released package's `engines.node` sits inside the
 * `engines.node` of every runtime dependency and required peer it installs
 * alongside.
 *
 * Nothing else in the repo sees a range that is too wide. The workspace runs
 * one Node, every build and test passes on it, and npm accepts the install on a
 * Node the package cannot run on. The ranges are read from the installed
 * packages, so a dependency bump that raises a floor fails this check.
 */

interface PackageJson {
  name: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function readManifest(file: string): PackageJson {
  return parseJson<PackageJson>(readFileSync(file, 'utf-8'));
}

/**
 * The manifest Node's resolution finds for `name` from `from`: the nearest
 * `node_modules/<name>` walking up from the package. A requirement that is not
 * installed is an error, because its range cannot be read.
 */
function installedManifest(name: string, from: string): PackageJson {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return readManifest(candidate);
    if (dir === dirname(dir)) break;
  }

  throw new Error(
    `${name} is not installed from ${from}, so its engines.node cannot be read`,
  );
}

function readReleaseProjectPatterns(): string[] {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  expect(patterns, 'nx.json must define release.projects').toBeDefined();

  return Array.isArray(patterns) ? patterns : [patterns as string];
}

/** Every released package, with the installed ranges of what it needs. */
const released: Promise<Manifest[]> = (async () => {
  const graph = await createProjectGraphAsync({ exitOnError: false });
  const names = findMatchingProjects(readReleaseProjectPatterns(), graph.nodes);

  return names.map((project) => {
    const root = join(workspaceRoot, graph.nodes[project]?.data.root ?? '');
    const manifest = readManifest(join(root, 'package.json'));
    const optional = manifest.peerDependenciesMeta ?? {};

    const required = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}).filter(
        (peer) => optional[peer]?.optional !== true,
      ),
    ];

    const requires: Requirement[] = required.map((name) => ({
      name,
      node: installedManifest(name, root).engines?.node,
    }));

    return { name: manifest.name, node: manifest.engines?.node, requires };
  });
})();

describe('every released package', () => {
  /**
   * A graph that matched no projects answers the assertion below vacuously,
   * which is a guard that cannot fail.
   */
  it('is checked against a workspace that has released packages', async () => {
    expect((await released).length).toBeGreaterThan(0);
  });

  it('declares a Node range that everything it needs runs on', async () => {
    expect(
      enginesViolations(await released).map(
        (violation) =>
          `${violation.name} declares engines.node ` +
          `"${violation.node ?? '(none)'}", but ${violation.requirement} ` +
          `declares "${violation.requires}"`,
      ),
      'Narrow engines.node to the range of the package it ' +
        'needs. npm installs a package on any Node its own range admits, and ' +
        'the package then fails on a Node its dependency cannot run on.',
    ).toEqual([]);
  });
});

/**
 * The rule itself, against fixtures. The workspace holds the invariant, so
 * asserting the rule against it asserts nothing about the rule.
 */
describe('the engines range rule', () => {
  function check(
    node: string | undefined,
    ...requires: Requirement[]
  ): string[] {
    return enginesViolations([{ name: 'pkg', node, requires }]).map(
      (violation) => violation.requirement,
    );
  }

  it('fails a range below a peer floor', () => {
    expect(check('>=20', { name: 'astro', node: '>=22.12.0' })).toEqual([
      'astro',
    ]);
  });

  it('passes the peer floor copied exactly', () => {
    expect(check('>=22.12.0', { name: 'astro', node: '>=22.12.0' })).toEqual(
      [],
    );
  });

  it('passes a floor above the peer floor', () => {
    expect(check('>=24', { name: 'astro', node: '>=22.12.0' })).toEqual([]);
  });

  /** A floor that clears a gapped range still admits the majors in its gaps. */
  it('fails a floor that admits a major the requirement leaves out', () => {
    expect(
      check('>=20.19.0', {
        name: '@nestjs/axios',
        node: '^20.19.0 || ^22.12.0 || >=24.0.0',
      }),
    ).toEqual(['@nestjs/axios']);
  });

  it('passes a requirement that declares no range', () => {
    expect(check('>=20', { name: 'tslib', node: undefined })).toEqual([]);
  });

  it('fails a package with no range of its own', () => {
    expect(check(undefined, { name: 'astro', node: '>=22.12.0' })).toEqual([
      'astro',
    ]);
  });

  it('reports every requirement the range falls outside of', () => {
    expect(
      check(
        '>=20',
        { name: 'react', node: '>=0.10.0' },
        { name: 'b', node: '>=22' },
        { name: 'a', node: '>=21' },
      ),
    ).toEqual(['a', 'b']);
  });

  it('throws on a range that is not semver', () => {
    expect(() => check('node twenty')).toThrow(/not a semver range/);
  });
});
