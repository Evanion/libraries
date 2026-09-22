import type { MetaRecord } from 'nextra';
import { groups, packages, readmeUrl } from '../app/navigation';

/** How a package appears in the sidebar: a section, or a link to its README. */
function entry(item: (typeof packages)[number]) {
  return item.documented
    ? item.title
    : { title: item.title, href: readmeUrl(item) };
}

/**
 * One group: its separator, then the packages under it in `navigation.ts` order.
 *
 * A separator rather than a folder. Nesting the packages under a Nextra folder
 * would put a group between a reader and every page inside it -- one more click,
 * and a collapsed group hides the package someone came for. A separator groups
 * the list while leaving every package one click away, which is what the sidebar
 * is for.
 */
function group(id: string, title: string) {
  const members = packages.filter((item) => item.group === id);

  if (members.length === 0) return {};

  return {
    [`group-${id}`]: { type: 'separator', title },
    ...Object.fromEntries(members.map((item) => [item.slug, entry(item)])),
  };
}

/**
 * The top level of the sidebar, built from `app/navigation.ts`.
 *
 * Written as a derivation rather than as a literal object so that there is one
 * list of packages in this app and not two. A package with no section here is
 * still listed, pointing at the README that documents it today -- Nextra throws
 * on a `_meta` key naming a page it cannot find, so the alternative is leaving
 * the package out of the navigation entirely, which is the failure this file
 * exists to prevent.
 *
 * The first entry is a link, not a page: the landing page is `app/page.tsx`,
 * outside the MDX content, and a reader inside a package's pages still wants
 * one click back to the whole index.
 *
 * The order is the order of `groups`, then of `packages` within each. A group
 * whose packages have all been removed emits no separator, because Nextra
 * renders one whether or not anything follows it.
 *
 * `testing` is the one literal key after them, and it is not a package: it is a
 * section about the repository, so it belongs to no group and cannot be derived
 * from `packages`. It sits last under its own separator because a reader
 * arrives looking for a library and reaches the question of whether to trust
 * one after they have found it.
 */
export default {
  index: { title: 'All packages', href: '/' },
  ...Object.assign({}, ...groups.map((it) => group(it.id, it.title))),
  'group-repository': { type: 'separator', title: 'This repository' },
  testing: 'How it is tested',
} satisfies MetaRecord;
