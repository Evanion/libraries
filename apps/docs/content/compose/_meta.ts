import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/compose` in: the nesting it replaces, then
 * the one thing that surprises them -- where the array is written decides
 * whether the per-entry type check runs at all -- then the surface.
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
  'type-checking': 'Where the Check Happens',
  api: 'API Reference',
} satisfies MetaRecord;
