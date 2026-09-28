import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/luhn` in: what a check character catches,
 * how to put one on an order code, the two calls that produce and verify one,
 * the dictionary and case folding an instance is built from, and which
 * dictionary a published standard covers.
 *
 * Migrating from 2.x sits after that band and before the reference. Only a
 * reader already holding codes issued by 2.x has that task.
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
  'getting-started': 'Getting Started',
  usage: 'Generating and Validating',
  dictionaries: 'Dictionaries',
  standards: 'Standards and Modulo Bias',
  migration: 'Migrating from 2.x',
  api: 'API Reference',
} satisfies MetaRecord;
