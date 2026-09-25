import type { MetaRecord } from 'nextra';

/**
 * Four bands, in the order a reader needs them: get something running, wire it
 * into the stack it runs in, answer the question they arrived with, then look
 * the mechanism up.
 *
 * `getting-started` heads Setup. A reader arriving at this band has installed
 * nothing, so the band opens on the page that installs the package, and the
 * three tiers below it address a reader whose policy already answers two
 * questions. `docs/specs/2026-09-25-documentation-standard.md` § 3 makes that
 * page stage 2 of the journey and fixes its filename, and
 * `tools/repo-checks/src/doc-floor.test.ts` requires it of every documented
 * section.
 *
 * Setup is staged by one decision, and each title names the decision.
 * `subject-rules` is the page where every condition reads the subject, so
 * nothing can decide `unevaluable`, and it carries the whole allow-and-deny
 * mechanism on that axis: default deny under an express allow, and an express
 * deny that outranks the allow. Nothing else is on it: `listing-permissions`
 * owns `capabilities` and `asking` owns the bound subject handle, and a cold
 * reader who met those two here as well called the step onto this page too
 * large. `object-rules` is the page where a condition
 * reads the object, which brings the typed builder, projections and the
 * `unevaluable` answer with it. The field axis is not on it. `writing` owns
 * that axis, and a reader who has just met a fourth decision state does not
 * also need a second axis on the same page. `advanced` is the page where one
 * service evaluates a document a different service wrote, which brings the
 * schema, the version and `parseMatrix`. The difficulty ladder is on each
 * page's `<PageSheet>`, and a title that repeated it would say less than the
 * sheet does. `ui-checks` closes Setup: the storefront `advanced` leaves
 * holding a fetched, version checked document draws a screen from it, so the
 * page takes the three preceding pages as read and adds the rendering.
 *
 * The slugs say what the page holds. A reader pastes a URL into a channel and
 * the path is all the recipient sees before they click, so `/acl/subject-rules`
 * names the page's subject where `/acl/simple` names a rung only this file can
 * rank. A moved path still answers: `apps/docs/tools/redirects.mjs` holds the
 * map from old path to new and writes an `index.html` at every old path
 * carrying a meta refresh and a canonical link, on the reasoning
 * `apps/docs/tools/md-siblings.mjs` states. The catch-all route owns every path
 * on this site, and under `output: 'export'` the deployed site is the contents
 * of `out/`, so the postbuild step that writes the file is what serves it. `tools/repo-checks/src/doc-redirects.test.ts` fails when an
 * entry in that map stops resolving. `matrix` keeps its slug, because the title
 * still names the matrix.
 *
 * Questions are titled as the question, not as the method, because that is what
 * a reader searches for. The method is in the first line of each.
 *
 * `asking` heads Questions and takes both rule tiers as read. It names the four
 * answers, `canMany`, `readsObject` and the clock, and every one of those reads
 * a deny rule or an `unevaluable`, so `subject-rules` teaches the deny and
 * `object-rules` teaches the `unevaluable` before a reader gets here. Its
 * `<PageSheet>` requires both, and the page reminds rather than teaches: a
 * reader who arrives from a search result meets one sentence per borrowed
 * concept and a link to the page that taught it.
 *
 * `testing` closes Questions, after `rule-changes`. It wires `diffMatrix` into
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
 * one is wiring over the same API rather than a further tier.
 * `choosing-an-integration` is the band's overview and heads it. The five guides are ordered by how many
 * places a reader has to write a decision. Express and NestJS are server-only
 * and have one, which is the simplest trust boundary there is. Astro SSR still
 * has one, and it sits in a page's frontmatter, which is the loader and the
 * action in one module. The two React platforms have two entry points reached
 * independently, so each owes two decisions, and both put the authoritative one
 * on the server and send the document to a client that re-renders without
 * enforcing. Many Services closes the band — a topology spans the five rather
 * than being a sixth of them.
 *
 * `resolution` follows `decision-object`, and it is the only Reference title
 * phrased as a question. It carries the whole of the precedence order, so
 * `decision-object` names the object a caller holds and `resolution` argues how
 * that object came out the way it did. A reader meets the decision before the order behind
 * it, and no other page restates the seven steps.
 *
 * `attacks` follows `security`. The contract argues the trust boundary and the
 * page is the ledger a reader checks a class of attack against, so the
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
  'subject-rules': 'Rules about who the user is',
  'object-rules': 'Rules about the thing being accessed',
  advanced: 'Rules that another service wrote',
  'ui-checks': 'Checking permissions in your UI',

  'group-platforms': { type: 'separator', title: 'Platforms' },
  'choosing-an-integration': 'Choosing a framework integration',
  express: 'Express',
  nestjs: 'NestJS',
  astro: 'Astro SSR',
  nextjs: 'Next.js (React Server Components)',
  'react-router': 'React Router 8',
  federation: 'Many Services',

  'group-questions': { type: 'separator', title: 'Questions' },
  asking: 'Can this user do this?',
  'listing-permissions': 'Listing everything a user may do',
  writing: 'Which fields may they write?',
  refusals: 'Why was this refused?',
  adopting: 'A policy from another service',
  publishing: 'Giving my rules to another service',
  errors: 'What can throw?',
  'rule-changes': 'What did editing my rules change about access?',
  testing: 'Testing a contract I consume',

  'group-reference': { type: 'separator', title: 'Reference' },
  limits: 'What this does not do',
  pitfalls: 'Caveats & Pitfalls',
  matrix: 'The matrix: your rules as JSON',
  authoring: 'Typed Authoring',
  'decision-object': 'The Decision object every check returns',
  resolution: 'Why deny, then allow, then deny?',
  fields: 'Field Permissions',
  security: 'Security Contract',
  attacks: 'Attack classes and how each is handled',
  api: 'API Reference',
  explorer: 'Explore a document you have',
} satisfies MetaRecord;
