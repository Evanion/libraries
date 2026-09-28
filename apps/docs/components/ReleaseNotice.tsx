import { Panel, Text } from '@evanion/baize-ui';
import { packages } from '../app/navigation';
import type { ReleaseState } from '../app/release-state';

export interface ReleaseNoticeProps extends ReleaseState {
  /**
   * Whether the page is under `/next/`, where it documents `main` and the
   * released pages are at the section's bare path.
   */
  next?: boolean;
  /**
   * Where the published version's own pages are, when it shipped any. A release
   * that shipped none is served from `main` at its bare path too, so there is
   * nothing different to link to.
   */
  releaseHref?: string;
}

/**
 * What version of a package these pages describe, on a page built from `main`.
 *
 * Mounted on the pages under `/next/`, and on a section with no version, whose
 * one copy is `main`'s. A page cut for a release says what it is itself, in the
 * `ArchiveNotice` the generator writes under its title. A reader who arrived
 * from a search result sees no sidebar and no switcher, so without this a page
 * reads as documentation of the version they just installed whether or not it
 * is -- the same reason `WorkshopNotice` says on the page what the sidebar's
 * Workshop separator says in the chrome.
 *
 * Two states, and the difference between them is the reader's next action. On a
 * released package that `main` has not moved past there is nothing to do, so it
 * is one line. When `main` is ahead, the page contains API the installed version
 * does not have, which is a caveat and gets a panel, and under `/next/` the
 * panel links the pages for the release they have.
 *
 * Nothing renders without a published version. That is `@evanion/feature` today
 * -- private, so nothing on npm to name -- and `WorkshopNotice` already says
 * more about it than this could.
 */
export default function ReleaseNotice({
  slug,
  published,
  ahead,
  next = false,
  releaseHref,
}: ReleaseNoticeProps) {
  const entry = packages.find((item) => item.slug === slug);

  if (!entry)
    throw new Error(`No package in navigation.ts has the slug ${slug}`);
  if (!published) return null;

  if (!ahead)
    return (
      <div className="docs-release">
        <Text size="sm" tone="moss">
          These pages document{' '}
          <code>
            {entry.name} {published}
          </code>
          , the version on npm.
        </Text>
      </div>
    );

  if (next)
    return (
      <div className="docs-release">
        <Panel heading="Unreleased changes">
          <Text size="sm">
            These pages document <code>main</code>, which has changes{' '}
            {published} does not. <code>npm install {entry.name}</code> gives
            you {published}
            {releaseHref ? (
              <>
                , <a href={releaseHref}>documented here</a>
              </>
            ) : (
              ', which shipped no documentation of its own'
            )}
            . Values on these pages are produced by running the current source
            on every build.
          </Text>
        </Panel>
      </div>
    );

  return (
    <div className="docs-release">
      <Panel heading="Ahead of the release">
        <Text size="sm">
          <code>npm install {entry.name}</code> gives you {published}. These
          pages document <code>main</code>, which has changes that release does
          not.
        </Text>
      </Panel>
    </div>
  );
}
