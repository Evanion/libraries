import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/feature` in: what a dependent toggle is,
 * how a feature is written down, how one is resolved, and how a resolved one is
 * held to a share of traffic. That is the whole core, in the order it is used.
 *
 * React follows the core because it decides nothing -- it carries an already
 * built store down a tree -- so it reads as a wiring step once resolution is
 * understood. Build-time planning comes after it: partitioning features into
 * resolvable now and deferred is the specialist case, for a build that does not
 * have the evaluation context, and a reader who never renders statically never
 * needs it.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Feature.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  configuration: 'Configuration',
  decisions: 'Decisions',
  rollouts: 'Rollouts',
  react: 'React',
  'build-time': 'Build-time Planning',
  api: 'API Reference',
} satisfies MetaRecord;
