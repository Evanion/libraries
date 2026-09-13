import { Panel, Text } from '@evanion/baize-ui';
import type { ReactNode } from 'react';
import { packages } from '../app/navigation';

export interface WorkshopNoticeProps {
  /** The package's folder under `content/`, as in `app/navigation.ts`. */
  slug: string;
  /** What is true today: where the code is, what covers it, what it is waiting on. */
  children?: ReactNode;
}

/**
 * The line at the top of a page for a package that is not on npm.
 *
 * The sidebar's Workshop separator is invisible to a reader who arrived from a
 * search result, so the page says it too. It renders nothing once the package's
 * `package.json` drops `private: true` -- `workshop` on the navigation entry is
 * held equal to that flag by `tools/repo-checks/src/docs-navigation.test.ts` --
 * so publishing the package removes this from every page that uses it, children
 * included.
 */
export default function WorkshopNotice({
  slug,
  children,
}: WorkshopNoticeProps) {
  const entry = packages.find((item) => item.slug === slug);

  if (!entry)
    throw new Error(`No package in navigation.ts has the slug ${slug}`);
  if (!entry.workshop) return null;

  return (
    <Panel heading="Not on npm yet">
      <Text size="sm">
        <code>npm install {entry.name}</code> does not resolve. The package is{' '}
        <code>private: true</code>, so a release run versions and tags it
        without publishing: npm cannot configure a trusted publisher for a
        package that does not exist on the registry, and the first version has
        to go up by hand.
      </Text>
      {children}
    </Panel>
  );
}
