/**
 * The components a cut page may mount.
 *
 * A page the archive generator cuts is read out of git at a pinned commit and
 * served for as long as that release is retained, while every component it
 * names is resolved from `main` on every build. A component that reads the
 * current navigation, imports a workspace package, or holds state beyond
 * presentation would make the old page render what `main` says rather than
 * what the release shipped, or stop it rendering at all the day that component
 * changes shape. `docs/specs/2026-09-13-released-by-default.md` § 8 sets the
 * constraint; this is its list, in one place, for the three things that hold a
 * page to it:
 *
 * 1. The cut parses every page it emits and fails on a JSX element outside
 *    `allowed`, which puts the failure at cut time, when a person is there.
 * 2. `tools/repo-checks/src/docs-archive.test.ts` asserts the same over every
 *    generated directory.
 * 3. `surface.test.ts` beside this file asserts each module named here imports
 *    neither `app/navigation.ts` nor a workspace runtime package.
 *
 * Plain ESM, so the generator can read it from `node` and the test from Vitest.
 */

/**
 * Every element name a cut page may carry, with the module that defines it.
 *
 * The `@evanion/baize-ui` primitives are the site's prose surface and hold no
 * state. `PageSheet` is presentation over its own props, and `ApiFilter` hides
 * entries that are already on the page and owns none of them.
 * `ArchiveNotice` and `FrozenProbe` exist for cut pages and take every value as
 * a literal prop.
 */
export const allowed = new Map([
  ['Panel', '@evanion/baize-ui'],
  ['Text', '@evanion/baize-ui'],
  ['Chip', '@evanion/baize-ui'],
  ['ButtonLink', '@evanion/baize-ui'],
  ['PageSheet', 'components/PageSheet.tsx'],
  ['ApiFilter', 'components/api/ApiFilter.tsx'],
  ['ArchiveNotice', 'components/archive/ArchiveNotice.tsx'],
  ['FrozenProbe', 'components/archive/FrozenProbe.tsx'],
]);

/**
 * Components that execute the workspace package in the reader's browser, and
 * that the cut replaces with a link to the same page under `/next/`.
 *
 * A playground evaluates live React, a specimen and a demo run the package on
 * input the reader types, and none of them has a value to freeze: what they
 * show is whatever `main` computes. `<Probe>` is not here, because a probe is
 * one call and one result, and the cut freezes that pair into `FrozenProbe`.
 */
export const live = new Set([
  'PlaygroundExamples',
  'WidgetPlayground',
  'AccessDemo',
  'AstroRenderDemo',
  'DataDemo',
  'FieldWriteDemo',
  'UnevaluableDemo',
  'ComposeSpecimen',
  'LuhnSpecimen',
  'PolicySpecimen',
  'TokenSpecimen',
  'UrnSpecimen',
]);
