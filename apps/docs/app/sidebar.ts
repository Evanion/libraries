import type { MetaRecord } from 'nextra';
import {
  groups,
  packages,
  readmeUrl,
  type DocumentedPackage,
} from './navigation';

/**
 * Which tree a sidebar lists: the released pages at the bare paths, or `main`
 * under `/next/`.
 */
export type Tree = 'current' | 'next';

/**
 * How a package appears in one tree's sidebar: a section, or a link.
 *
 * A package with no section links to the README that documents it today. An
 * unversioned section has no `/next/` tree, so the `/next/` sidebar links to
 * its bare path rather than naming a directory that is not there: Nextra fails
 * the build on a `_meta` key naming a page it cannot find.
 */
function entry(item: DocumentedPackage, tree: Tree) {
  if (!item.documented) return { title: item.title, href: readmeUrl(item) };
  if (tree === 'next' && item.unversioned)
    return { title: item.title, href: `/${item.slug}/` };

  return item.title;
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
function group(id: string, title: string, tree: Tree) {
  const members = packages.filter((item) => item.group === id);

  if (members.length === 0) return {};

  return {
    [`group-${id}`]: { type: 'separator', title },
    ...Object.fromEntries(
      members.map((item) => [item.slug, entry(item, tree)]),
    ),
  };
}

/**
 * The package groups of one tree's sidebar, built from `app/navigation.ts`.
 *
 * Written as a derivation rather than as a literal object so that there is one
 * list of packages in this app and not two. `content/_meta.ts` lists them for
 * the bare paths and `content/next/_meta.ts` for `/next/`, and the order is the
 * order of `groups`, then of `packages` within each. A group whose packages
 * have all been removed emits no separator, because Nextra renders one whether
 * or not anything follows it.
 */
export function packageGroups(tree: Tree): MetaRecord {
  return Object.assign({}, ...groups.map((it) => group(it.id, it.title, tree)));
}
