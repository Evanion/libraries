import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/luhn` in: what a check character buys
 * them, the two calls that produce and verify one, the one thing the package is
 * configured by, and what the generalisation to an arbitrary alphabet is and is
 * not standardised by.
 *
 * Migrating from 2.x sits after that band and before the reference. It is a task
 * rather than a concept, and only a reader already holding 2.x tokens has it.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Luhn.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  usage: 'Generating and Validating',
  dictionaries: 'Dictionaries',
  standards: 'Standards and Modulo Bias',
  migration: 'Migrating from 2.x',
  api: 'API Reference',
} satisfies MetaRecord;
