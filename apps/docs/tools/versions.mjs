/**
 * Release versions as the docs site files them.
 *
 * Plain ESM for the reason `redirects.mjs` is: the route reads it while Next
 * renders, the archive generator reads it from `node`, and the repo-checks read
 * it from Vitest, and a `.ts` module would need a build step before the second
 * of those could import it.
 */

/**
 * A version segment: `v3` at or above 1.0.0, `v0.2` below it.
 *
 * Reserved as the first segment inside a package section. A page named `v2.mdx`
 * and an archive directory named `v2` are the same URL, and a static export
 * resolves that by whichever file was written last.
 */
export const VERSION_SEGMENT = /^v\d+(\.\d+)?$/;

/**
 * A `major.minor.patch` version with an optional prerelease, or `null`.
 *
 * @param {string} text
 * @returns {{ major: number, minor: number, patch: number, prerelease: string | null } | null}
 */
export function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text);

  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/** Semver order between two prerelease identifiers. */
function compareIdentifiers(x, y) {
  const numeric = [/^\d+$/.test(x), /^\d+$/.test(y)];

  if (numeric[0] && numeric[1]) return Number(x) - Number(y);
  if (numeric[0] !== numeric[1]) return numeric[0] ? -1 : 1;

  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Semver order between two prereleases: identifier by identifier, numeric ones
 * as numbers and below any alphanumeric one, and a list below a longer one it
 * begins. So `beta.2` is below `beta.10`, and `beta` below `beta.1`.
 */
function comparePrereleases(a, b) {
  const left = a.split('.');
  const right = b.split('.');

  for (let at = 0; at < Math.min(left.length, right.length); at++) {
    const order = compareIdentifiers(left[at], right[at]);
    if (order !== 0) return order;
  }

  return left.length - right.length;
}

/** Semver order: numeric per field, and a prerelease below its release. */
export function compareVersions(a, b) {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    Number(a.prerelease === null) - Number(b.prerelease === null) ||
    comparePrereleases(a.prerelease ?? '', b.prerelease ?? '')
  );
}

/**
 * The caret-compatible line a version belongs to, as its URL segment.
 *
 * `^1.2.0` resolves to 1.x and `^0.2.0` to 0.2.x only, and `nx.json` sets
 * `adjustSemverBumpsForZeroMajorVersion`, so below 1.0.0 the minor is the
 * breaking bump. The segment is the unit a reader is pinned to: `v2` for any
 * 2.x, `v0.2` for any 0.2.x.
 */
export function segmentOf(version) {
  const parsed = typeof version === 'string' ? parseVersion(version) : version;

  if (!parsed) throw new Error(`'${version}' is not a version`);

  return parsed.major > 0 ? `v${parsed.major}` : `v0.${parsed.minor}`;
}

/**
 * Every tag of a package that names a version, prereleases included, newest
 * first.
 *
 * `nx.json` writes a tag as `{projectName}@{version}`, so the prefix is the
 * package name and the `@` after it.
 *
 * @param {string} name
 * @param {readonly string[]} tags
 */
function taggedVersions(name, tags) {
  const prefix = `${name}@`;

  return tags
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => ({
      tag,
      version: tag.slice(prefix.length),
      parsed: parseVersion(tag.slice(prefix.length)),
    }))
    .filter((release) => release.parsed !== null)
    .sort((a, b) => compareVersions(b.parsed, a.parsed));
}

/**
 * A package's releases, newest first, grouped by line, and the release each
 * line's documentation is cut from.
 *
 * Returns one entry per line, each holding its tags newest first, and the
 * lines themselves newest first. A prerelease is in no line: `npm install`
 * resolves the `latest` dist-tag, which a prerelease does not move, so the
 * bare path and a line's directory document what a reader installs.
 *
 * `cut` is the release the line's documentation is cut from: its newest
 * release whose patch number is 0. Only a release that changes the major or
 * the minor number gets documentation of its own, and a patch is documented
 * by its x.y.0 (`docs/specs/2026-09-13-released-by-default.md` decision 1).
 * A line whose newest x.y has no x.y.0 tag, because that x.y was released
 * before this repository tagged, is cut from the first tag the x.y has.
 *
 * @param {string} name
 * @param {readonly string[]} tags
 */
export function releaseLines(name, tags) {
  const lines = new Map();

  for (const release of taggedVersions(name, tags)) {
    if (release.parsed.prerelease !== null) continue;

    const segment = segmentOf(release.parsed);
    const line = lines.get(segment) ?? { segment, releases: [], parsed: [] };
    line.releases.push({ tag: release.tag, version: release.version });
    line.parsed.push(release.parsed);
    lines.set(segment, line);
  }

  return [...lines.values()].map(({ segment, releases, parsed }) => {
    const [newest] = parsed;
    const patches = parsed.filter(
      (each) => each.major === newest.major && each.minor === newest.minor,
    ).length;

    return { segment, cut: releases[patches - 1], releases };
  });
}

/**
 * The tags of a package's versions in a later x.y than `version`'s,
 * prereleases included.
 *
 * A commit that one of these is an ancestor of has changed the package past
 * the documentation `version` is cut for, whatever `nx release version
 * --dry-run` computes there: the dry run measures from the newest tag, and
 * says nothing about an older line. A patch of the same x.y is not among
 * them, because the x.y.0 documentation is that patch's documentation too.
 *
 * @param {string} name
 * @param {readonly string[]} tags
 * @param {string} version
 */
export function taggedPast(name, tags, version) {
  const parsed = parseVersion(version);
  if (!parsed) throw new Error(`'${version}' is not a version`);

  return taggedVersions(name, tags)
    .filter(
      (release) =>
        release.parsed.major > parsed.major ||
        (release.parsed.major === parsed.major &&
          release.parsed.minor > parsed.minor),
    )
    .map((release) => release.tag);
}
