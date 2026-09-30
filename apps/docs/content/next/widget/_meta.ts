import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/widget` in: the item model, one saved page
 * checked by a script that fails on a problem, the whole report
 * `validateItems` hands back, how a renderer lays out a payload that passes,
 * a renderer of the reader's own, then the surface.
 *
 * Six pages and no separator. Every page before the API reference is a
 * teaching page that leans on the one before it, so there is no band a reader
 * enters sideways, and the API reference sits off the end of the order.
 *
 * `problems` is the deep-dive on the check: every problem one call reports,
 * the `required` map and the registry lookup. Its tables also serve a reader
 * who arrives holding a line their build printed, so each section stands
 * alone.
 *
 * `layout` carries the demonstration role, which `apps/docs/app/navigation.ts`
 * records as `demo: 'layout'`. Above five pages the role owes a page of its
 * own, and the control there moves the items of a page a renderer draws, which
 * is the order and nesting the item model defines. It also sets the two
 * published renderers' handling of children and the wrapper side by side, which
 * `renderer` builds on.
 *
 * `renderer` is the warning text and printer the two published renderers
 * share, taught by writing a third.
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
  layout: 'Order and Nesting',
  renderer: 'Your Own Renderer',
  api: 'API Reference',
} satisfies MetaRecord;
