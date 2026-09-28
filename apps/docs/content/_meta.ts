import type { MetaRecord } from 'nextra';
import { packageGroups } from '../app/sidebar';

/**
 * The top level of the sidebar on the bare paths, where each package serves its
 * newest release.
 *
 * The package groups come from `app/sidebar.ts`, which builds them from
 * `app/navigation.ts` so that there is one list of packages in this app and not
 * two. A package with no section here is still listed, pointing at the README
 * that documents it today -- Nextra throws on a `_meta` key naming a page it
 * cannot find, so the alternative is leaving the package out of the navigation
 * entirely, which is the failure this file exists to prevent.
 *
 * The first entry is a link, not a page: the landing page is
 * `app/(home)/page.tsx`, outside the MDX content, and a reader inside a
 * package's pages still wants one click back to the whole index.
 *
 * `testing` is the one literal key after the groups, and it is not a package: it
 * is a section about the repository, so it belongs to no group and cannot be
 * derived from `packages`. It sits last under its own separator because a reader
 * arrives looking for a library and reaches the question of whether to trust
 * one after they have found it. It has no version, so it has no `/next/` copy.
 *
 * `next` is the tree of pages written on `main`, served under `/next/`. It is
 * hidden here, because a reader on the released pages would otherwise find a
 * "Next" entry at the foot of every package list; `content/next/_meta.ts` is the
 * sidebar a reader inside it sees.
 */
export default {
  index: { title: 'All packages', href: '/' },
  ...packageGroups('current'),
  'group-repository': { type: 'separator', title: 'This repository' },
  testing: 'How it is tested',
  next: { type: 'page', display: 'hidden' },
} satisfies MetaRecord;
