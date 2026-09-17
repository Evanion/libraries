import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/widget` in: what the core is and who has a
 * reason to open it, one payload written and checked end to end, the report
 * `validateItems` hands back, then the surface.
 *
 * Four pages and no separator. A band groups the pages a reader enters
 * sideways, and below five pages there is nothing to enter sideways from: the
 * teaching order is the whole order, and the two lookup pages sit off the end
 * of it.
 *
 * The demonstration role sits on `getting-started` rather than on a page of its
 * own, which `apps/docs/app/navigation.ts` records as `demo: 'getting-started'`.
 * There is one worked payload to show, and a page of its own would put the
 * practice a click away from the item shape it practises.
 *
 * `problems` is the message catalogue, and it is reference by the arrival test:
 * a reader opens it holding a line their build printed. It comes before the API
 * reference because that is the lookup a reader reaches for first, and after
 * the teaching because nothing on it is a step.
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
