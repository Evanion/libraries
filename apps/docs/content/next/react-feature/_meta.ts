import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/react-feature` in: what the binding adds,
 * one provider and one component that works, then the surface.
 *
 * Three pages and no separator. A band groups the pages a reader enters
 * sideways, and below five pages there is nothing to enter sideways from: the
 * teaching order is the whole order, and the reference sits off the end of it.
 *
 * The demonstration role sits on `getting-started` rather than on a page of its
 * own, which `apps/docs/app/navigation.ts` records as `demo: 'getting-started'`
 * and which `doc-floor.test.ts` allows a section of five pages or fewer.
 * `@evanion/react-acl` takes the same allowance. There is one worked case, a
 * checkout under one provider, and a page of its own would put the practice a
 * click away from the concept it practises.
 *
 * Nothing here teaches a rule, a rollout share or a variant weight. Those
 * belong to `@evanion/feature` and the pages link the `/feature/` page that
 * owns each, which is the rule for a section a reader enters knowing what they
 * want: this one is about a provider and four hooks, and re-teaching the core
 * here would give a reader two places to find out what a `reason` means.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a `_meta` key that
 * names a page it cannot find, and
 * `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  api: 'API Reference',
} satisfies MetaRecord;
