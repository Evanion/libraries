/**
 * Which superseded majors owe the docs site an archived section.
 *
 * `docs/specs/2026-09-13-versioned-docs.md` builds the release labelling and
 * defers the archive itself, on a measurement: the whole buildable archive today
 * is four `@evanion/urn` 1.x pages differing from the 2.x tag's by 51 lines.
 * What makes deferring safe is that snapshots are read from git tags, which are
 * permanent, so the machinery built later captures every release in between. The
 * cost of deferring is forgetting, and this is what replaces remembering.
 *
 * The rule, and each clause earns its place:
 *
 * - A package below 1.0.0 has no majors to retain. `0.x` is the statement that
 *   the API is not stable, and archiving each minor of an unstable API archives
 *   noise. Same reading as `adjustSemverBumpsForZeroMajorVersion` in `nx.json`.
 * - The current major is never considered however many pages it has. Those pages
 *   document the version that is still on npm; filing them as an archive would
 *   put two documents under one version number.
 * - A superseded major whose newest tag has no pages under `content/<slug>/` owes
 *   nothing. There is no document to preserve.
 *
 * The IO is passed in so the rule can be asserted against fixtures. The real
 * repository has exactly one case today and a different set after the next
 * release, so a test that reads only this repository tests today's history.
 */

/** The version part of a release tag, which `nx.json` writes as `{name}@{version}`. */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** A prerelease sorts below the release of the same triple. */
  prerelease: string | null;
}

export interface ArchiveCandidate {
  /** The package's folder under `content/`. */
  slug: string;
  /** The published package name. */
  name: string;
  /** The superseded major, as the URL segment would spell it: `v1` is `1`. */
  major: number;
  /** The newest tag in that major, which is what a snapshot would be taken from. */
  tag: string;
  /** How many pages that tag carries under `content/<slug>/`. */
  pages: number;
}

export interface ArchiveInputs {
  /** The documented packages, as `apps/docs/app/navigation.ts` lists them. */
  packages: readonly { name: string; slug: string }[];
  /** Every tag in the repository. */
  tags: readonly string[];
  /** Files under `apps/docs/content/<slug>/` in the tree at a tag. */
  pagesAtTag: (tag: string, slug: string) => number;
  /** Whether `apps/docs/content/<slug>/v<major>/` exists and holds pages. */
  hasArchive: (slug: string, major: number) => boolean;
}

export function parseVersion(text: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text);

  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compare(a: Version, b: Version): number {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    Number(a.prerelease === null) - Number(b.prerelease === null) ||
    (a.prerelease ?? '').localeCompare(b.prerelease ?? '')
  );
}

/** A package's release tags, newest first. */
function releases(
  name: string,
  tags: readonly string[],
): { tag: string; version: Version }[] {
  const prefix = `${name}@`;

  return tags
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => ({ tag, version: parseVersion(tag.slice(prefix.length)) }))
    .filter(
      (entry): entry is { tag: string; version: Version } =>
        entry.version !== null,
    )
    .sort((a, b) => compare(b.version, a.version));
}

/**
 * Every superseded major that has pages at its tag, whether or not it has an
 * archive. The candidates a reader could be sent to if the archive existed.
 */
export function archiveCandidates(
  inputs: Omit<ArchiveInputs, 'hasArchive'>,
): ArchiveCandidate[] {
  const candidates: ArchiveCandidate[] = [];

  for (const entry of inputs.packages) {
    const tagged = releases(entry.name, inputs.tags);
    const current = tagged[0];

    if (!current || current.version.major < 1) continue;

    const superseded = new Map<number, string>();

    for (const { tag, version } of tagged) {
      if (version.major >= current.version.major) continue;
      // `tagged` is newest first, so the first tag seen in a major is its newest.
      if (!superseded.has(version.major)) superseded.set(version.major, tag);
    }

    for (const [major, tag] of superseded) {
      const pages = inputs.pagesAtTag(tag, entry.slug);

      if (pages > 0)
        candidates.push({
          slug: entry.slug,
          name: entry.name,
          major,
          tag,
          pages,
        });
    }
  }

  return candidates.sort((a, b) => a.tag.localeCompare(b.tag));
}

/** The candidates with no archived section on disk: what the check fails on. */
export function missingArchives(inputs: ArchiveInputs): ArchiveCandidate[] {
  return archiveCandidates(inputs).filter(
    (candidate) => !inputs.hasArchive(candidate.slug, candidate.major),
  );
}
