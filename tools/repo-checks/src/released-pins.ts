/**
 * Which dependencies between released packages are not an exact pin at the
 * version the dependency's manifest carries.
 *
 * `nx release` rewrites an exact version during the version step, because
 * `isValidRange` in @nx/js `release/utils/semver.js` does not count one as a
 * range. A spec it does count as a range is left alone while the dependency's
 * new version satisfies it, and stops the run once it does not:
 * `preserveMatchingDependencyRanges` defaults to true, and @nx/js
 * `release/version-actions.js` throws for a range the new version falls
 * outside. nx keeps a caret range through every minor and patch of the
 * dependency and refuses its next major.
 *
 * The IO is passed in so the rule can be asserted against fixtures.
 */

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export type Manifest = {
  /** The project's directory, relative to the workspace root. */
  root: string;
  name: string;
  version: string;
} & Partial<Record<DependencyField, Record<string, string>>>;

interface Pin {
  /** The dependent's directory. */
  root: string;
  field: DependencyField;
  dependency: string;
  spec: string;
  /** The version the dependency's manifest carries. */
  version: string;
}

/** Every dependency one released package declares on another. */
export function releasedPins(released: readonly Manifest[]): Pin[] {
  const versions = new Map(released.map((m) => [m.name, m.version]));

  return released
    .flatMap((manifest) =>
      DEPENDENCY_FIELDS.flatMap((field) =>
        Object.entries(manifest[field] ?? {}).flatMap(([dependency, spec]) => {
          const version = versions.get(dependency);

          return version === undefined
            ? []
            : [{ root: manifest.root, field, dependency, spec, version }];
        }),
      ),
    )
    .sort(
      (a, b) =>
        a.root.localeCompare(b.root) ||
        a.dependency.localeCompare(b.dependency),
    );
}

/** The pins whose spec is anything other than the dependency's own version. */
export function loosePins(released: readonly Manifest[]): Pin[] {
  return releasedPins(released).filter((pin) => pin.spec !== pin.version);
}
