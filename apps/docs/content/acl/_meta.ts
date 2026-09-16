import type { MetaRecord } from 'nextra';

/**
 * Three bands, in the order a reader needs them: get something running, answer
 * the question they arrived with, then look the mechanism up.
 *
 * Setup is staged by one decision rather than by difficulty. Simple is
 * subject-only conditions, where nothing can decide `unevaluable`; intermediate
 * is the moment a condition reads the row, which brings projections, the typed
 * builder and the field axis with it; advanced is what follows from the
 * document outliving the process that wrote it. Many Services is advanced-tier
 * and stands alone because a topology is a different concern from a feature.
 *
 * Questions are titled as the question, not as the method, because that is what
 * a reader searches for. The method is in the first line of each.
 *
 * Caveats heads the reference band rather than sitting in Questions: it is
 * material to check code against rather than a task, and a reader meets it from
 * the overview and from the end of every setup tier.
 *
 * Separators rather than folders, on the same reasoning as `content/_meta.ts`:
 * a folder puts one more click between a reader and every page inside it, and a
 * collapsed group hides the page they came for.
 *
 * `integrations` closes the Setup band: a platform guide is the last step of
 * setup, and each one is wiring over the same API rather than a further tier.
 * It is the one folder here, and `content/acl/integrations/_meta.ts` orders the
 * platforms inside it.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra throws on a `_meta` key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',

  'group-setup': { type: 'separator', title: 'Setup' },
  simple: 'Simple',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  federation: 'Many Services',
  integrations: 'Integrations',

  'group-questions': { type: 'separator', title: 'Questions' },
  asking: 'Can this user do this?',
  capabilities: 'What can they do at all?',
  writing: 'Which fields may they write?',
  refusals: 'Why was this refused?',
  adopting: 'A policy from another service',

  'group-reference': { type: 'separator', title: 'Reference' },
  pitfalls: 'Caveats & Pitfalls',
  matrix: 'The Matrix Document',
  authoring: 'Typed Authoring',
  decisions: 'Decisions',
  fields: 'Field Permissions',
  security: 'Security Contract',
  api: 'API Reference',
} satisfies MetaRecord;
