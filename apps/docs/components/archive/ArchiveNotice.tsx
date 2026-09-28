import { Panel, Text } from '@evanion/baize-ui';

/**
 * How the pages a notice sits on were produced.
 *
 * - `tag`: cut from the release's own tag.
 * - `seed`: cut from a later commit that `nx release` versions as the release,
 *   because the release shipped no pages of its own.
 * - `line`: cut from the newest release of a superseded line.
 * - `next`: `main`, served at the release's path because the release shipped no
 *   pages and `main` has moved past it.
 */
export type ArchiveKind = 'tag' | 'seed' | 'line' | 'next';

export interface ArchiveNoticeProps {
  kind: ArchiveKind;
  /** The published package name. */
  package: string;
  /** The release these pages stand for. */
  version: string;
  /** The commit the pages were cut from, short. Absent for `next`. */
  sha?: string;
  /** For `line`: the newest release, which the section's bare path serves. */
  current?: string;
  /** For `line`: where that newest release is documented. */
  href?: string;
}

/**
 * Where the values on a page came from, stated on the page.
 *
 * The archive generator writes one under the title of every page it cuts, with
 * every prop a literal. That keeps a cut page's statement about itself inside
 * the page, so the `.md` sibling an agent reads says it too, and it keeps this
 * component free of anything that reads the repository: it imports no module of
 * the site's own and no package, and renders the same whatever `main` becomes.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 8 is the claim each form
 * restates: every value on the site was produced by running the version the
 * page documents, in CI, at a named commit.
 */
export default function ArchiveNotice({
  kind,
  package: name,
  version,
  sha,
  current,
  href,
}: ArchiveNoticeProps) {
  if (kind === 'next')
    return (
      <div className="docs-release">
        <Panel heading="No documentation for this release">
          <Text size="sm">
            <code>npm install {name}</code> gives you {version}, and no
            documentation was published with it. These pages document{' '}
            <code>main</code>, which has changes {version} does not. Values on
            them are produced by running the current source on every build.
          </Text>
        </Panel>
      </div>
    );

  if (kind === 'line')
    return (
      <div className="docs-release">
        <Panel heading="An earlier release">
          <Text size="sm">
            These pages document{' '}
            <code>
              {name} {version}
            </code>
            . <code>npm install {name}</code> gives you {current}
            {href ? (
              <>
                , documented <a href={href}>here</a>
              </>
            ) : null}
            . Values on this page were produced by running {version} in CI at{' '}
            <code>{sha}</code> and are not re-executed.
          </Text>
        </Panel>
      </div>
    );

  return (
    <div className="docs-release">
      <Text size="sm" tone="moss">
        <code>
          {name} {version}
        </code>
        .{' '}
        {kind === 'seed' ? (
          <>
            Values on this page were produced by running the source at{' '}
            <code>{sha}</code>, which <code>nx release</code> versions as{' '}
            {version}, and are not re-executed.
          </>
        ) : (
          <>
            Values on this page were produced by running {version} in CI at{' '}
            <code>{sha}</code> and are not re-executed.
          </>
        )}
      </Text>
    </div>
  );
}
