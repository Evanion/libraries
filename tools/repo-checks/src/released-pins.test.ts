import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loosePins, releasedPins, type Manifest } from './released-pins';

/**
 * The invariant: a released package names another released package at exactly
 * that package's version.
 *
 * The released packages are the projects `release.projects` in nx.json matches,
 * which are the ones `nx release` versions and whose dependents it rewrites. A
 * range between two of them passes every check until the dependency's next
 * major, and then `nx release version` exits 1 on it.
 */

function readReleaseProjectPatterns(): string[] {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  expect(patterns, 'nx.json must define release.projects').toBeDefined();

  return Array.isArray(patterns) ? patterns : [patterns as string];
}

const released: Promise<Manifest[]> = (async () => {
  const graph = await createProjectGraphAsync({ exitOnError: false });

  const names = new Set(
    findMatchingProjects(readReleaseProjectPatterns(), graph.nodes),
  );

  return Object.values(graph.nodes)
    .filter((node) => names.has(node.name))
    .map(({ data: { root } }) => {
      const manifest = JSON.parse(
        readFileSync(join(workspaceRoot, root, 'package.json'), 'utf-8'),
      ) as Omit<Manifest, 'root'>;

      return { ...manifest, root };
    });
})();

describe('every dependency between released packages', () => {
  /** A workspace with no such dependency answers the assertion vacuously. */
  it('is checked against a workspace that has some', async () => {
    expect(releasedPins(await released).length).toBeGreaterThan(0);
  });

  it('is an exact pin at the version the dependency carries', async () => {
    expect(
      loosePins(await released).map(
        (pin) =>
          `${pin.root} ${pin.field}: ${pin.dependency} is ${pin.spec}, ` +
          `has to be ${pin.version}`,
      ),
      'Write the exact version. nx rewrites an exact pin when it versions the ' +
        'dependency, and refuses a range the new version falls outside.',
    ).toEqual([]);
  });
});

/**
 * The rule itself, against fixtures. The workspace holds the invariant today, so
 * asserting the rule against it asserts nothing about the rule.
 */
describe('the exact pin rule', () => {
  const luhn: Manifest = {
    root: 'libs/luhn',
    name: '@evanion/luhn',
    version: '3.0.1',
  };

  function token(field: keyof Manifest, spec: string): Manifest {
    return {
      root: 'libs/token',
      name: '@evanion/token',
      version: '0.1.1',
      [field]: { '@evanion/luhn': spec },
    };
  }

  function check(manifests: readonly Manifest[]): string[] {
    return loosePins(manifests).map((pin) => `${pin.root} ${pin.spec}`);
  }

  it('passes an exact pin at the dependency version', () => {
    expect(check([luhn, token('dependencies', '3.0.1')])).toEqual([]);
  });

  it('fails a caret range the dependency version satisfies', () => {
    expect(check([luhn, token('dependencies', '^3.0.0')])).toEqual([
      'libs/token ^3.0.0',
    ]);
  });

  it('fails an exact pin at a version other than the dependency version', () => {
    expect(check([luhn, token('dependencies', '3.0.0')])).toEqual([
      'libs/token 3.0.0',
    ]);
  });

  /** `*` never excludes a version, but it names none either. */
  it('fails a wildcard', () => {
    expect(check([luhn, token('dependencies', '*')])).toEqual(['libs/token *']);
  });

  it.each([
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const)('reads %s', (field) => {
    expect(check([luhn, token(field, '^3.0.0')])).toEqual([
      'libs/token ^3.0.0',
    ]);
  });

  /** nx versions only the released packages, so it rewrites nothing else. */
  it('ignores a dependency outside the released packages', () => {
    expect(
      check([
        {
          root: 'libs/token',
          name: '@evanion/token',
          version: '0.1.1',
          dependencies: { '@evanion/baize-ui': '*', semver: '^7.0.0' },
        },
      ]),
    ).toEqual([]);
  });

  it('reports every loose pin, ordered by dependent then dependency', () => {
    const widget: Manifest = {
      root: 'libs/widget',
      name: '@evanion/widget',
      version: '0.1.1',
    };
    const adapter = (name: string, spec: string): Manifest => ({
      root: `libs/${name}`,
      name: `@evanion/${name}`,
      version: '0.3.1',
      dependencies: { '@evanion/widget': spec },
    });

    expect(
      check([
        widget,
        adapter('react-widget', '^0.1.1'),
        adapter('astro-widget', '~0.1.0'),
        luhn,
        token('dependencies', '3.0.1'),
      ]),
    ).toEqual(['libs/astro-widget ~0.1.0', 'libs/react-widget ^0.1.1']);
  });
});
