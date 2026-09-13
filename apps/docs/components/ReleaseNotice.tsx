import { Panel, Text } from '@evanion/baize-ui';
import { packages } from '../app/navigation';
import type { ReleaseState } from '../app/release-state';

export type ReleaseNoticeProps = ReleaseState;

/**
 * What version of a package these pages describe.
 *
 * The site builds from `main`, and `main` runs ahead of every release tag. A
 * reader who arrived from a search result sees no sidebar and no switcher, so
 * without this the page reads as documentation of the version they just
 * installed whether or not it is -- the same reason `WorkshopNotice` says on the
 * page what the sidebar's Workshop separator says in the chrome.
 *
 * Two states, and the difference between them is the reader's next action. On a
 * released package that `main` has not moved past there is nothing to do, so it
 * is one line. When `main` is ahead, the page contains API the installed version
 * does not have, which is a caveat and gets a panel.
 *
 * Nothing renders without a published version. That is `@evanion/feature` today
 * -- private, so nothing on npm to name -- and `WorkshopNotice` already says
 * more about it than this could.
 */
export default function ReleaseNotice({
  slug,
  published,
  ahead,
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
