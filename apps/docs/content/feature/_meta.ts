import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/feature` in: what a dependent toggle is,
 * the shop's two flags end to end, how a feature is written down, how one is
 * resolved, how a resolved one is held to a share of customers, and how a
 * resolved one is split across named variants. That is the whole core, in the
 * order it is used.
 *
 * Getting Started sits second because it is the section's one narrative: it
 * writes the new checkout and express pickup down, resolves them for a
 * customer, and turns the parent off. Every page after it takes one of those
 * four steps apart, so a reader who has been through it meets each one already
 * holding the example.
 *
 * Variants follows Rollouts because variant assignment buckets a subject the
 * same way a rollout does. A reader who has met bucketing on that page reuses
 * it here.
 *
 * React follows the core because it decides nothing -- it carries an already
 * built store down a tree -- so it reads as a wiring step once resolution is
 * understood. Build-time planning comes after it: partitioning features into
 * resolvable now and deferred is the specialist case, for a build that does not
 * have the evaluation context, and a reader who never renders statically never
 * needs it.
 *
 * Observing comes last of the pages a reader learns from. An observer reports
 * what an entry point returned, so the four events name a decision, a plan and
 * a toggle result, and a reader who has met all three reads an event as a
 * record of work already understood. It also carries the argument that exposure
 * tracking belongs at the render site, which a reader can only weigh once they
 * know that `resolve` decides every configured feature.
 *
 * Distribution follows Observing because it is the only page where the
 * configuration arrives from an external source. While every previous page
 * writes definitions in a file, this one introduces a document served by a
 * control plane, a reload that replaces it, and a digest two processes
 * compare. A reader who has not yet met a decision, a variant, and a toggle
 * result has nothing to compare a reloaded document against; the page's
 * `changed` list names keys whose stored intent moved, which is the
 * distinction Observing just taught.
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
  'getting-started': 'Getting Started',
  configuration: 'Configuration',
  decisions: 'Decisions',
  rollouts: 'Rollouts',
  variants: 'Variants',
  react: 'React',
  'build-time': 'Build-time Planning',
  observing: 'Observing',
  distribution: 'Distribution',
  api: 'API Reference',
} satisfies MetaRecord;
