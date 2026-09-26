import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/widget` in: the item model, one payload
 * installed, written and checked, the whole report `validateItems` hands back,
 * then the surface.
 *
 * Four pages and no separator. A band groups the pages a reader enters
 * sideways, and below five pages there is nothing to enter sideways from: the
 * teaching order is the whole order, and the API reference sits off the end
 * of it.
 *
 * The demonstration role sits on `getting-started` rather than on a page of its
 * own, which `apps/docs/app/navigation.ts` records as `demo: 'getting-started'`.
 * There is one worked payload to show, and a page of its own would put the
 * practice a click away from the item shape it practises.
 *
 * `problems` is the deep-dive on the check: every problem one call reports,
 * the `required` map, the registry lookup, and the warning a renderer prints
 * when nobody ran the check. Its tables also serve a reader who arrives holding
 * a line their build printed, so each section stands alone.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Widget.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  problems: 'What It Reports',
  api: 'API Reference',
} satisfies MetaRecord;
