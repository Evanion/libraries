import type { MetaRecord } from 'nextra';

/**
 * The section is organized into four bands to guide the reader from starting
 * the engine and wiring it into the stack to answering their specific question
 * and finally looking up the mechanism. Separators divide the bands. A folder
 * would add one more click between a reader and every page in it, on the
 * reasoning `content/_meta.ts` gives.
 *
 * The narrative begins with `getting-started`, which serves as the single
 * narrative for the section. This page writes a new checkout and express
 * pickup, resolves them for a customer, demonstrates a rollout that places two
 * customers in different buckets, and turns the parent off. Every subsequent
 * page decomposes one of these steps, ensuring the reader arrives already
 * holding the example. The filename is fixed by
 * `docs/specs/2026-09-25-documentation-standard.md` and is required for every
 * documented section by `tools/repo-checks/src/doc-floor.test.ts`.
 *
 * The `configuration` page follows because later pages rely on stored
 * definitions. `decisions` follows configuration because a decision is the
 * result of a definition resolution. `rollouts` is the demonstration page and
 * follows decisions, as it is the first addition a reader makes to a flag after
 * the on/off switch and is cited in `getting-started`. `variants` follows
 * `rollouts` because variant assignment buckets a subject the same way a
 * rollout does, allowing the reader to reuse the concept of bucketing. `build-
 * time` closes the setup sequence by partitioning features into those
 * resolvable now and those deferred for builds without evaluation context, a
 * detail unnecessary for readers who do not render statically.
 *
 * Platforms follows the setup sequence because a platform guide represents the
 * final step of setup. `choosing-an-integration` heads the band and sends a
 * reader to the platform page that matches where the decision is read. The React binding's own pages live in the section at
 * `/react-feature/`; `nextjs` here covers the server half of an App Router
 * application and the set it ships to the client.
 * `microservices` is the one page in the band that names no framework. It follows
 * a document from the process that writes it to the processes that install it.
 * `nestjs` follows it because the application it wires is the process that
 * writes that document. `express` sits between them: it wires one handle to
 * `res.locals` and reads it in a handler, which is the smaller of the two
 * application pages. `nextjs` and `react-router` close the band: they are the
 * two platform pages whose process sends decisions to a client tree. `nextjs`
 * sends them from a Server Component, and `react-router` sends them from a
 * loader and resolves the flag again in an action.
 * `astro` follows them as the platform page whose pages ship no JavaScript: it
 * reads a flag in the page and sends a decision to the browser only through an
 * island, which the storefront does not have.
 *
 * The questions band uses the questions themselves as titles to match user
 * searches. `distribution` is the only page where configuration comes from an
 * external source, including a document served by a control plane, a reload
 * that replaces it, and a digest compared by two processes. `hydration`
 * follows distribution because it compares that digest's version against the
 * decisions a server ships. `observing` follows hydration. Because an
 * observer reports what an entry point returned, its four events name a
 * decision, a plan, and a toggle result, allowing a reader who understands all
 * three to read an event as a record of known work. This
 * page also argues that exposure tracking belongs at the render site, a point
 * the reader can weigh once they know that `resolve` decides every configured
 * feature.
 * `testing` closes the band. It tests a decision, a rollout boundary and a
 * variant assignment, and it sends the reader to the published fixtures for the
 * agreement between two processes, so it follows the pages that explain each.
 *
 * The reference band opens with `limits` and `pitfalls`. `limits` lists what a
 * reader decides against before writing code: the nine things the library
 * leaves to the application. `pitfalls` lists what a reader checks code against
 * once there is some. `advanced` follows them and covers what the pages before
 * it leave at their defaults: the schema's two vocabularies, the rollout field
 * and seed, the `maxStale` budget, and the variant seed and sticky entries. The
 * `api` page closes the section as the place where a reader looks up a name
 * after the other content.
 *
 * Any page not listed here is appended to the end, so adding one is not
 * required. Renaming one requires an edit here: Nextra throws on a key naming a
 * page it cannot find, and `tools/repo-checks/src/docs-navigation.test.ts`
 * fails first.
 */
export default {
  index: 'Overview',

  'group-setup': { type: 'separator', title: 'Setup' },
  'getting-started': 'Getting started',
  configuration: 'Writing a feature down',
  decisions: 'Resolving a feature',
  rollouts: 'Rollouts',
  variants: 'Variants',
  'build-time': 'Build-time planning',

  'group-platforms': { type: 'separator', title: 'Platforms' },
  'choosing-an-integration': 'Choosing an integration',
  microservices: 'Many Processes',
  express: 'Express',
  nestjs: 'NestJS',
  nextjs: 'Next.js (React Server Components)',
  'react-router': 'React Router 8',
  astro: 'Astro SSR',

  'group-questions': { type: 'separator', title: 'Questions' },
  distribution: 'How do I serve my configuration?',
  hydration: 'How do two processes agree?',
  observing: 'What did the engine just answer?',
  testing: 'How do I test a flag?',

  'group-reference': { type: 'separator', title: 'Reference' },
  limits: 'What it does not do',
  pitfalls: 'Pitfalls',
  advanced: 'Advanced',
  api: 'API Reference',
} satisfies MetaRecord;
