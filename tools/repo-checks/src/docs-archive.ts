/**
 * What `apps/docs/archives.json` may say about a release.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 7 and § 11.10 are the rules.
 * A pin is the one line that decides what a release's documentation is cut
 * from, and a re-cut changes that line in a reviewed pull request. So each pin
 * has to name a release that happened, point at a commit a reviewer could have
 * seen on `main`, and say why when it is not the release's own tag:
 *
 * - The package is published. A workshop package is `private`: a release run
 *   tags it, npm never has it, and the site serves it as unreleased.
 * - The tag exists, spells the package and the version, and the version is in
 *   the line the pin is filed under.
 * - A pinned commit exists, descends from the tag, and is on `main`. Pinning
 *   released documentation to an unrelated commit, or to one no review has
 *   seen, is the quiet rewrite the pin file exists to make visible. A commit on
 *   a pull request's branch is neither: `main` is rebase-only, so the merge
 *   writes that commit again under another SHA.
 * - The pin is one the site reads. The generator serves the current line and the
 *   one before it, and applies a pin only to its line's newest release: a pin
 *   for an older release, or for a line past those two, changes nothing and
 *   reads as a decision nobody is making.
 * - No later version's tag is an ancestor of the pinned commit. Such a commit
 *   documents that later version, whatever the dry run below computes: the dry
 *   run measures from the package's newest tag, so it cannot see that a v1
 *   pin names a commit past 2.0.0.
 * - A pin that is not the tag's own commit, or that reads another path, or that
 *   serves the release from `/next/`, carries a reason, and no two reasons are
 *   the same. A copied justification is a justification nobody wrote.
 * - At a commit that is not the tag's, `nx release version --dry-run` computes
 *   the version the pin records. That is the seed predicate of § 5, and it
 *   holds a re-cut to the same standard: a commit that has changed the package
 *   is not documentation of the release before it.
 *
 * The IO is passed in so the rules can be asserted against fixtures. This
 * repository's pins change with every release.
 */

export interface Pin {
  version: string;
  tag: string;
  sha?: string;
  path?: string;
  next?: true;
  reason?: string;
}

export interface PinInputs {
  /** The pin file, by slug and then by line segment. */
  pins: Record<string, Record<string, Pin>>;
  /** The documented packages, as `apps/docs/app/navigation.ts` lists them. */
  packages: readonly { name: string; slug: string; workshop: boolean }[];
  /** The commit a ref names, or `null` when the repository has none. */
  commit: (ref: string) => string | null;
  /** Whether the first commit is an ancestor of the second, or the same. */
  isAncestor: (ancestor: string, descendant: string) => boolean;
  /** The tip of `main`, which every pinned commit is an ancestor of. */
  main: string;
  /**
   * The version `nx release version --dry-run` computes for a package with
   * the tree at a commit, or `null` when it computes no change.
   */
  dryRunAt: (sha: string, name: string) => string | null;
  /**
   * The line a version belongs to, `v3` or `v0.2`: `segmentOf` from
   * `apps/docs/tools/versions.mjs`, which the generator files lines by.
   */
  segmentOf: (version: string) => string;
  /**
   * The tags of a package's versions above a version: `taggedAfter` from
   * `apps/docs/tools/versions.mjs`, over the repository's tags.
   */
  taggedAfter: (name: string, version: string) => readonly string[];
  /**
   * A package's release lines, newest first, each with its releases newest
   * first: `releaseLines` from `apps/docs/tools/versions.mjs`, over the
   * repository's tags, which the generator plans from.
   */
  releaseLines: (
    name: string,
  ) => readonly { segment: string; releases: readonly { version: string }[] }[];
}

/** Every rule a pin file breaks, as one line each. */
export function pinFaults(inputs: PinInputs): string[] {
  const faults: string[] = [];
  const reasons = new Map<string, string>();

  for (const [slug, lines] of Object.entries(inputs.pins)) {
    const entry = inputs.packages.find((each) => each.slug === slug);

    if (!entry) {
      faults.push(`${slug}: no documented package has this slug`);
      continue;
    }
    if (entry.workshop) {
      faults.push(
        `${slug}: ${entry.name} is private, so npm has no release of it to document`,
      );
      continue;
    }

    for (const [segment, pin] of Object.entries(lines)) {
      const at = `${slug}.${segment}`;

      if (pin.tag !== `${entry.name}@${pin.version}`)
        faults.push(
          `${at}: ${pin.tag} is not the tag of ${entry.name} ${pin.version}`,
        );

      let line: string | null = null;
      try {
        line = inputs.segmentOf(pin.version);
      } catch {
        faults.push(`${at}: '${pin.version}' is not a version`);
      }
      if (line !== null && line !== segment)
        faults.push(
          `${at}: ${pin.version} is in the line ${line}, not ${segment}`,
        );

      const tagged = inputs.commit(pin.tag);
      if (!tagged) {
        faults.push(
          `${at}: ${pin.tag} was never released, the repository has no such tag`,
        );
        continue;
      }

      const released = inputs.releaseLines(entry.name);
      const kept = released.slice(0, 2).map((each) => each.segment);
      const newest = released.find((each) => each.segment === segment)
        ?.releases[0]?.version;
      if (!kept.includes(segment))
        faults.push(
          `${at}: the site keeps ${kept.join(' and ')} and reads no pin for ${segment}`,
        );
      else if (newest !== pin.version)
        faults.push(
          `${at}: ${newest} is the newest release in ${segment}, so the site cuts it from its own tag and reads no pin for ${pin.version}`,
        );

      const deviates = pin.next === true || pin.path !== undefined;

      if (pin.sha !== undefined) {
        const pinned = inputs.commit(pin.sha);

        if (!pinned) {
          faults.push(`${at}: ${pin.sha} is not a commit in this repository`);
          continue;
        }
        if (!inputs.isAncestor(tagged, pinned))
          faults.push(`${at}: ${pin.sha} does not descend from ${pin.tag}`);
        if (!inputs.isAncestor(pinned, inputs.main))
          faults.push(`${at}: ${pin.sha} is not on main`);

        for (const later of inputs.taggedAfter(entry.name, pin.version)) {
          const released = inputs.commit(later);
          if (released && inputs.isAncestor(released, pinned))
            faults.push(
              `${at}: ${pin.sha} carries ${later}, a later release than ${pin.version}`,
            );
        }

        if (pinned !== tagged) {
          if (!pin.reason)
            faults.push(
              `${at}: pins a commit past its tag and gives no reason`,
            );

          const computed = inputs.dryRunAt(pinned, entry.name);
          if (computed !== null)
            faults.push(
              `${at}: nx release version --dry-run at ${pin.sha} computes ${computed}, not ${pin.version}`,
            );
        }
      }

      if (deviates && !pin.reason)
        faults.push(
          `${at}: ${pin.next ? 'is served from /next/' : 'reads another path'} and gives no reason`,
        );

      if (pin.reason) {
        const held = reasons.get(pin.reason);
        if (held) faults.push(`${at}: gives the same reason as ${held}`);
        else reasons.set(pin.reason, at);
      }
    }
  }

  return faults;
}
