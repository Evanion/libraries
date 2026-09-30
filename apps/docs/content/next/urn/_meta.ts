import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/urn` in: what it is, how to install it,
 * one deep-dive per task, and then the reference.
 *
 * `namespaces` comes first because reading a URN another service wrote is the
 * first thing a service does with one. `validation` lists what each part may
 * contain, and `components` points back to that list for the characters an r-
 * or q-component allows. `separators` steps outside RFC 8141, so it is the last
 * deep-dive. The API reference comes after them because a reader enters it
 * from a search result, and the stage pages above it are the ones walked in
 * order.
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
  namespaces: 'Several namespaces',
  validation: 'Checking input',
  components: 'r-, q- and f-components',
  encoding: 'Encoding and comparing',
  separators: 'Schemes and separators',
  api: 'API Reference',
} satisfies MetaRecord;
