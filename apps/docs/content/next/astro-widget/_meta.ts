import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/astro-widget` in: what rendering a page
 * from data looks like, the registry and the component that does it, failing a
 * build on the CMS data, the page-level props and nesting, and then every fault
 * a bad save carries.
 * Validation follows getting started because it is the step after something
 * renders. The fault catalogue comes after the nesting page because half its
 * examples are nested items.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Astro Widget.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  validation: 'Validation',
  layout: 'Page Data and Nesting',
  'bad-items': 'Bad Items',
  api: 'API Reference',
} satisfies MetaRecord;
