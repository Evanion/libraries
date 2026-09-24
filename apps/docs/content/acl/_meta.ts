import type { MetaRecord } from 'nextra';

/**
 * Four bands, in the order a reader needs them: get something running, wire it
 * into the stack it runs in, answer the question they arrived with, then look
 * the mechanism up.
 *
 * `getting-started` heads Setup, above `simple`, and this is the one place this
 * file changed its mind. The argument below for opening Setup on `simple` is
 * that each Setup page names a decision about what a rule may read, and that
 * `simple` is the first of those decisions. That argument is sound about the
 * three tiers and it answered the wrong question. A reader arriving at Setup has
 * not yet decided what a rule may read; they have not installed the package.
 * `npm install @evanion/acl` was written once in this whole section, at
 * `simple.mdx:54`, below a notice, a page sheet, a four-part brief and two prose
 * sections, so the first page of Setup taught a concept tier to somebody with
 * nothing installed. `docs/specs/2026-09-25-documentation-standard.md` § 3 makes
 * the Setup article stage 2 of the journey and
 * `tools/repo-checks/src/doc-floor.test.ts` had already recorded the gap in
 * `doc-floor-allowance.json`.
 *
 * The three tiers keep their order and their argument. What changed is that they
 * now start from a reader who has a policy answering questions, so `simple` is
 * the first decision rather than the first page.
 *
 * Setup is staged by one decision, and each title names the decision rather
 * than the rung. `simple` is the page where every condition reads the subject,
 * so nothing can decide `unevaluable`. `intermediate` is the page where a
 * condition reads the object, which brings projections, the typed builder and
 * the field axis with it. `advanced` is the page where one service evaluates a
 * document a different service wrote, which brings the schema, the version and
 * `parseMatrix`. The difficulty ladder is on each page's `<PageSheet>`, and
 * a title that repeated it would say less than the sheet does. `interface`
 * closes Setup: the storefront `advanced` leaves holding a fetched, version
 * checked document draws a screen from it, so the page takes the three
 * preceding pages as read and adds the rendering.
 *
 * The slugs stay `simple`, `intermediate` and `advanced`. A URL a reader has
 * bookmarked or a search engine has indexed costs more to move than the titles
 * gained by moving it.
 *
 * Questions are titled as the question, not as the method, because that is what
 * a reader searches for. The method is in the first line of each.
 *
 * `testing` closes Questions, after `changes`. It wires `diffMatrix` into
 * `contractDrift`'s differ seam and takes the `MatrixDiff` vocabulary as read,
 * so the page that teaches that vocabulary comes first. It also takes
 * `adopting` as read, because a consumer replays its questions against two
 * documents it adopted with `parseMatrix`.
 *
 * Limits heads the reference band. It is what a reader decides against before
 * writing any code, so it precedes Caveats, which is what a reader checks code
 * against once there is some. The overview links it from `When acl is the wrong
 * tool`, so an evaluating reader reaches it without opening the band.
 *
 * Caveats follows Limits rather than sitting in Questions: it is material to
 * check code against rather than a task, and a reader meets it from the
 * overview and from the end of every Setup page.
 *
 * Separators rather than folders, on the same reasoning as `content/_meta.ts`:
 * a folder puts one more click between a reader and every page inside it, and a
 * collapsed group hides the page they came for.
 *
 * Platforms follows Setup: a platform guide is the last step of setup, and each
 * one is wiring over the same API rather than a further tier. `platforms` is
 * the band's overview and heads it. The five guides are ordered by how many
 * places a reader has to write a decision. Express and NestJS are server-only
 * and have one, which is the simplest trust boundary there is. Astro SSR still
 * has one, and it sits in a page's frontmatter, which is the loader and the
 * action in one module. The two React platforms have two entry points reached
 * independently, so each owes two decisions, and both put the authoritative one
 * on the server and send the document to a client that re-renders without
 * enforcing. Many Services closes the band — a topology spans the five rather
 * than being a sixth of them.
 *
 * `resolution` follows `decisions`, and it is the only Reference title phrased
 * as a question. It carries the whole of the precedence order, so `decisions`
 * describes the object a caller holds and `resolution` argues how that object
 * came out the way it did. A reader meets the decision before the order behind
 * it, and no other page restates the seven steps.
 *
 * `register` follows `security`. The contract argues the trust boundary and the
 * register is the ledger a reader checks a class of attack against, so the
 * argument comes first and the rows a reader scans come after it.
 *
 * `explorer` closes Reference, after `api`. Every other page in the band
 * documents this package; that one takes a document the reader brought and
 * reports on it, so it is the only page whose subject arrives from outside. It
 * sits last because a reader gets there holding a document, which means they
 * came from `matrix` or `adopting` rather than from the page above it.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra throws on a `_meta` key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',

  'group-setup': { type: 'separator', title: 'Setup' },
  'getting-started': 'Getting started',
  simple: 'Rules that read the subject',
  intermediate: 'Rules that read the object',
  advanced: 'Rules that another service wrote',
  interface: 'One policy behind a screen',

  'group-platforms': { type: 'separator', title: 'Platforms' },
  platforms: 'Overview',
  express: 'Express',
  nestjs: 'NestJS',
  astro: 'Astro SSR',
  'next-rsc': 'React Server Components',
  'react-router': 'React Router 8',
  federation: 'Many Services',

  'group-questions': { type: 'separator', title: 'Questions' },
  asking: 'Can this user do this?',
  capabilities: 'What can they do at all?',
  writing: 'Which fields may they write?',
  refusals: 'Why was this refused?',
  adopting: 'A policy from another service',
  publishing: 'Giving my rules to another service',
  errors: 'What can throw?',
  changes: 'What did this change do to access?',
  testing: 'Testing a contract I consume',

  'group-reference': { type: 'separator', title: 'Reference' },
  limits: 'What this does not do',
  pitfalls: 'Caveats & Pitfalls',
  matrix: 'The Matrix Document',
  authoring: 'Typed Authoring',
  decisions: 'Decisions',
  resolution: 'Why deny, then allow, then deny?',
  fields: 'Field Permissions',
  security: 'Security Contract',
  register: 'Security Register',
  api: 'API Reference',
  explorer: 'Explore a document you have',
} satisfies MetaRecord;
