import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/token` in: what a code looks like, how to
 * get one minted, the two calls that mint and check one, then the two things
 * that decide whether the shape they picked is the right one -- which characters a code is drawn from,
 * and how many codes that alphabet and length can carry before two collide.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the alphabet and puts the API reference second. The labels drop the
 * package name the pages repeat: the section is already called Token.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  usage: 'Generating and Validating',
  alphabet: 'The Alphabet',
  entropy: 'Entropy and Collisions',
  api: 'API Reference',
} satisfies MetaRecord;
