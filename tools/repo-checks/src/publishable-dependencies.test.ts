import { describe, expect, it } from 'vitest';

import { releasedManifests, type Manifest } from './released-manifests.js';
import { unpublishedDependencies } from './publishable-dependencies.js';

/**
 * The invariant: every dependency a published package installs is itself
 * published.
 *
 * `released-pins.test.ts` holds the version on the same edges and says nothing
 * about whether the dependency ships. An exact pin at a version the registry
 * never received is the failure this one catches.
 */

const released: Promise<Manifest[]> = releasedManifests();

describe('every dependency a published package installs', () => {
  /** A workspace with no such dependency answers the assertion vacuously. */
  it('is checked against a workspace that publishes a package with dependencies', async () => {
    const installed = (await released)
      .filter((manifest) => manifest.private !== true)
      .flatMap((manifest) => Object.keys(manifest.dependencies ?? {}));

    expect(installed.length).toBeGreaterThan(0);
  });

  it('is a package this repository publishes', async () => {
    expect(
      unpublishedDependencies(await released).map(
        (edge) =>
          `${edge.root} ${edge.field}: ${edge.dependency} carries ` +
          `private: true`,
      ),
      'Either publish the dependency, or mark the dependent private until it ' +
        'does. nx release publish skips a private project and publishes its ' +
        'dependent, and the install of the dependent then answers E404 for ' +
        'the dependency.',
    ).toEqual([]);
  });
});

/**
 * The rule itself, against fixtures. The workspace holds the invariant today, so
 * asserting the rule against it asserts nothing about the rule.
 */
describe('the published dependency rule', () => {
  const core: Manifest = {
    root: 'libs/feature',
    name: '@evanion/feature',
    version: '0.0.1',
    private: true,
  };

  function adapter(
    field: 'dependencies' | 'devDependencies' | 'peerDependencies',
    extra: Partial<Manifest> = {},
  ): Manifest {
    return {
      root: 'libs/react-feature',
      name: '@evanion/react-feature',
      version: '0.0.1',
      [field]: { '@evanion/feature': '0.0.1' },
      ...extra,
    };
  }

  function check(manifests: readonly Manifest[]): string[] {
    return unpublishedDependencies(manifests).map(
      (edge) => `${edge.root} ${edge.field} ${edge.dependency}`,
    );
  }

  it('fails a published package that depends on a private one', () => {
    expect(check([core, adapter('dependencies')])).toEqual([
      'libs/react-feature dependencies @evanion/feature',
    ]);
  });

  it('fails it through peerDependencies, which an install reports unmet', () => {
    expect(check([core, adapter('peerDependencies')])).toEqual([
      'libs/react-feature peerDependencies @evanion/feature',
    ]);
  });

  /** Nobody installs a dependency's devDependencies. */
  it('passes a devDependency on a private package', () => {
    expect(check([core, adapter('devDependencies')])).toEqual([]);
  });

  it('passes a private package that depends on a private one', () => {
    expect(check([core, adapter('dependencies', { private: true })])).toEqual(
      [],
    );
  });

  it('passes a published package that depends on a published one', () => {
    expect(
      check([{ ...core, private: undefined }, adapter('dependencies')]),
    ).toEqual([]);
  });

  /** A dependency outside the released packages comes off the registry. */
  it('passes a dependency no released package declares', () => {
    expect(
      check([
        {
          root: 'libs/token',
          name: '@evanion/token',
          version: '0.1.1',
          dependencies: { '@evanion/luhn': '3.0.1', semver: '^7.0.0' },
        },
      ]),
    ).toEqual([]);
  });

  it('reports every edge, ordered by dependent then dependency', () => {
    const widget: Manifest = {
      root: 'libs/widget',
      name: '@evanion/widget',
      version: '0.1.1',
      private: true,
    };
    const binding = (name: string): Manifest => ({
      root: `libs/${name}`,
      name: `@evanion/${name}`,
      version: '0.3.1',
      dependencies: { '@evanion/widget': '0.1.1', '@evanion/feature': '0.0.1' },
    });

    expect(check([widget, core, binding('react-widget')])).toEqual([
      'libs/react-widget dependencies @evanion/feature',
      'libs/react-widget dependencies @evanion/widget',
    ]);
  });
});
