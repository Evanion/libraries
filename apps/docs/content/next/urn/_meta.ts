import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/urn` in: what it is, how to install it,
 * the part of RFC 8141 that is not the assigned name, the tasks the shop's
 * services do with it, and then the reference.
 *
 * The r-, q- and f-components sit before the examples because they are syntax
 * a reader needs to read the fields `parse` returns. The page carries the
 * section's probe, where that syntax is typed against a live parse. The API
 * reference comes last because a reader enters it from a search result, and
 * the stage pages above it are the ones walked in order.
 *
 * Without this file Nextra orders the folder by filename, which puts the API
 * reference before the installation instructions. The labels drop the package
 * name the pages repeat: the section is already called URN.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  components: 'r-, q- and f-components',
  examples: 'Examples',
  api: 'API Reference',
} satisfies MetaRecord;
