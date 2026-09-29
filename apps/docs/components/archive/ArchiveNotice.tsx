import { Panel, Text } from '@evanion/baize-ui';
import type { ReactNode } from 'react';

/**
 * Which release the pages a notice sits on stand for.
 *
 * - `current`: the current line's x.y.0 release, at the section's bare path.
 * - `line`: a superseded line's x.y.0 release, at `/<slug>/v<seg>/`.
 * - `next`: a release that shipped no pages of its own, at the bare path, whose
 *   pages are `main`'s.
 */
export type ArchiveKind = 'current' | 'line' | 'next';

/**
 * Which commit the values on a cut page came from.
 *
 * - `tag`: the release's own tag.
 * - `seed`: a later commit that `nx release` versions as the same release,
 *   because the release shipped no pages.
 * - `recut`: a later commit a pull request re-cut the release from.
 */
export type ArchiveSource = 'tag' | 'seed' | 'recut';

export interface ArchiveNoticeProps {
  kind: ArchiveKind;
  /** How the pages were cut. Absent for `next`, which is not cut. */
  source?: ArchiveSource;
  /** The published package name. */
  package: string;
  /** The release these pages stand for: an x.y.0 release. */
  version: string;
  /**
   * The newest patch of `version` on npm, which these pages document too.
   * Absent when `version` is the newest release of its x.y.
   */
  published?: string;
  /** The commit the pages were cut from, short. Absent for `next`. */
  sha?: string;
  /** For `line`: the newest release, which the section's bare path serves. */
  current?: string;
  /** For `line`: where that newest release is documented. */
  href?: string;
}

/** Where a cut page's values came from, as one sentence. */
function provenance(
  source: ArchiveSource | undefined,
  version: string,
  published: string | undefined,
  sha: string | undefined,
): ReactNode {
  if (source === 'seed')
    return (
      <>
        Values on this page were produced by running the source at{' '}
        <code>{sha}</code>, which <code>nx release</code> versions as{' '}
        {published ?? version}, and are not re-executed.
      </>
    );

  if (source === 'recut')
    return (
      <>
        Values on this page were produced by running the source at{' '}
        <code>{sha}</code>, a later commit than the {version} tag, and are not
        re-executed.
      </>
    );

  return (
    <>
      Values on this page were produced by running {version} in CI at{' '}
      <code>{sha}</code> and are not re-executed.
    </>
  );
}

/** The patch releases the pages document besides their own, as a clause. */
function patches(published: string | undefined, onNpm: boolean): ReactNode {
  if (!published) return null;

  return (
    <>
      {' '}
      and its patch releases up to {published}
      {onNpm ? ', the version on npm' : null}
    </>
  );
}

/**
 * Where the values on a page came from, stated on the page.
 *
 * The archive generator writes one under the title of every page it serves for
 * a release, with every prop a literal. That keeps a page's statement about
 * itself inside the page, so the `.md` sibling an agent reads says it too, and
 * it keeps this component free of anything that reads the repository: it
 * imports no module of the site's own and no package, and renders the same
 * whatever `main` becomes.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 8 is the claim each form
 * restates: every value on the site was produced by running the version the
 * page documents, in CI, at a named commit. Decision 1 is why a page names
 * two versions: a line is documented by its x.y.0, and a reader who installed
 * a later patch is reading the documentation of that patch as well.
 *
 * `data-release` names the release in the markup, so a check over the static
 * export can hold each version directory to what `content/versions.json` says
 * it serves.
 */
export default function ArchiveNotice({
  kind,
  source,
  package: name,
  version,
  published,
  sha,
  current,
  href,
}: ArchiveNoticeProps) {
  if (kind === 'next')
    return (
      <div className="docs-release" data-release={version}>
        <Panel heading="No documentation for this release">
          <Text size="sm">
            <code>npm install {name}</code> gives you{' '}
            {published
              ? `${published}, a patch of ${version}, and no documentation was published with ${version}.`
              : `${version}, and no documentation was published with it.`}{' '}
            These pages document <code>main</code>, which has changes {version}{' '}
            does not. Values on them are produced by running the current source
            on every build.
          </Text>
        </Panel>
      </div>
    );

  if (kind === 'line')
    return (
      <div className="docs-release" data-release={version}>
        <Panel heading="An earlier release">
          <Text size="sm">
            These pages document{' '}
            <code>
              {name} {version}
            </code>
            {patches(published, false)}. <code>npm install {name}</code> gives
            you {current}
            {href ? (
              <>
                , documented <a href={href}>here</a>
              </>
            ) : null}
            . {provenance(source, version, published, sha)}
          </Text>
        </Panel>
      </div>
    );

  return (
    <div className="docs-release" data-release={version}>
      <Text size="sm" tone="moss">
        <code>
          {name} {version}
        </code>
        {patches(published, true)}.{' '}
        {provenance(source, version, published, sha)}
      </Text>
    </div>
  );
}
