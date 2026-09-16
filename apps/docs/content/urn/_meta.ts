import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/urn` in: what it is, how to install it,
 * the part of RFC 8141 that is not the assigned name, what it exposes, what
 * that looks like in use.
 *
 * The r-, q- and f-components sit before the reference because they are syntax
 * rather than surface: a reader who has not met `?+`, `?=` and `#` reads the
 * fields `parse` returns as arbitrary. The page carries the section's probe,
 * where that syntax is typed against a live parse.
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
  api: 'API Reference',
  examples: 'Examples',
} satisfies MetaRecord;
