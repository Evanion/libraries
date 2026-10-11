import {
  dependencyFields,
  type DependencyField,
  type Manifest,
} from './released-manifests.js';

/**
 * Which dependencies a published package declares on a package this repository
 * does not publish.
 *
 * `nx release publish` skips a project whose manifest carries `private: true`
 * and publishes every other project under `release.projects`. The skip is
 * per project, so a release run that versions a private core and a public
 * adapter together puts the adapter on the registry naming a dependency that is
 * not there, and `npm install` of the adapter answers E404 for the core. The
 * registry is where it surfaces: the pin is exact, the version numbers agree,
 * the workspace install resolves the dependency from the workspace, and every
 * check that reads one manifest at a time passes.
 *
 * Only the fields a consumer's install reads. `dependencies` and
 * `optionalDependencies` are fetched, `peerDependencies` is resolved against
 * what the consumer has and reported as unmet, and `devDependencies` is
 * ignored outside the dependency's own repository.
 *
 * The direction that is fine, and why it is not checked: a private package may
 * name a published one, and a private package may name another private one.
 * Nothing installs either from the registry.
 *
 * The IO is passed in so the rule can be asserted against fixtures.
 */

/** The fields whose contents a consumer's install tries to resolve. */
const INSTALLED_FIELDS: readonly DependencyField[] = dependencyFields.filter(
  (field) => field !== 'devDependencies',
);

export interface UnpublishedDependency {
  /** The published package's directory. */
  root: string;
  field: DependencyField;
  /** The dependency, which this repository holds back. */
  dependency: string;
}

export function unpublishedDependencies(
  released: readonly Manifest[],
): UnpublishedDependency[] {
  const held = new Set(
    released.filter((m) => m.private === true).map((m) => m.name),
  );

  return released
    .filter((manifest) => manifest.private !== true)
    .flatMap((manifest) =>
      INSTALLED_FIELDS.flatMap((field) =>
        Object.keys(manifest[field] ?? {})
          .filter((dependency) => held.has(dependency))
          .map((dependency) => ({ root: manifest.root, field, dependency })),
      ),
    )
    .sort(
      (a, b) =>
        a.root.localeCompare(b.root) ||
        a.dependency.localeCompare(b.dependency),
    );
}
