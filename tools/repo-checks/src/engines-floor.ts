import { subset, validRange } from 'semver';

/**
 * Which released packages declare a Node range wider than a package they need
 * accepts.
 *
 * npm reads a package's `engines.node` when a consumer installs it. A package
 * that declares `>=20` while its peer `astro` declares `>=22.12.0` installs on
 * Node 20 and then fails there, because astro cannot run on it. The package's
 * own range has to sit inside the range of every package it cannot run
 * without: each runtime dependency and each required peer.
 *
 * An optional peer is left out. A consumer who does not install it is not bound
 * by its range, and npm checks its range itself for a consumer who does.
 *
 * The IO is passed in so the rule can be asserted against fixtures: this
 * repository holds the invariant once its manifests are right, and a check
 * asserted only against the repository tests nothing about the rule.
 */

export interface Requirement {
  /** The package name, as the manifest's dependency field spells it. */
  name: string;
  /** Its installed `engines.node`, or `undefined` when it declares none. */
  node: string | undefined;
}

export interface Manifest {
  name: string;
  /** The package's own `engines.node`. */
  node: string | undefined;
  /** The runtime dependencies and required peers, as installed. */
  requires: readonly Requirement[];
}

/** One way a manifest's `engines.node` is wider than it can run on. */
export interface Violation {
  name: string;
  node: string | undefined;
  /** The package whose range `node` falls outside of. */
  requirement: string;
  /** That package's `engines.node`. */
  requires: string;
}

/**
 * Every requirement whose `engines.node` does not contain the manifest's own.
 * A manifest with no `engines.node` claims every Node, so any requirement that
 * declares a range is violated by it.
 */
export function enginesViolations(manifests: readonly Manifest[]): Violation[] {
  const violations: Violation[] = [];

  for (const manifest of manifests) {
    const own = manifest.node ?? '*';

    if (validRange(own) === null) {
      throw new Error(
        `${manifest.name} declares engines.node "${own}", which is not a ` +
          `semver range`,
      );
    }

    for (const requirement of manifest.requires) {
      if (requirement.node === undefined) continue;

      if (validRange(requirement.node) === null) {
        throw new Error(
          `${requirement.name} declares engines.node "${requirement.node}", ` +
            `which is not a semver range`,
        );
      }

      if (!subset(own, requirement.node)) {
        violations.push({
          name: manifest.name,
          node: manifest.node,
          requirement: requirement.name,
          requires: requirement.node,
        });
      }
    }
  }

  return violations.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.requirement.localeCompare(b.requirement),
  );
}
