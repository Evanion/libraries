import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/compose` in: what it is, one provider tree
 * that works, the type relationship that is the package's actual claim, then
 * the surface.
 *
 * Four pages and no separator. A band groups the pages a reader enters
 * sideways, and below five pages there is nothing to enter sideways from: the
 * teaching order is the whole order, and the reference sits off the end of it.
 *
 * The demonstration role sits on `getting-started` rather than on a page of its
 * own, which `apps/docs/app/navigation.ts` records as `demo: 'getting-started'`.
 * There is one worked case to show, and a page of its own would put the
 * practice a click away from the concept it practises.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Compose.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  'type-checking': 'Where the Check Happens',
  api: 'API Reference',
} satisfies MetaRecord;
