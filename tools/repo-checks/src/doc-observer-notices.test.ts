import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * The claims `docs/specs/2026-09-23-feature-observation-seam.md` puts on the
 * documentation itself, read back where the spec puts them. The spec names four
 * sections that word the documentation, and this file holds each placement one
 * of them asks for.
 *
 * § 1 closes by requiring the exposure warning at the member, because an
 * operator who reads "the library supports an observer" assumes the observer
 * counts exposures, and the numbers that assumption produces look plausible and
 * are wrong. That operator meets the member through an editor hover over
 * `observe` or through the API reference entry, and neither path crosses the
 * Observing page, so the warning sits on both.
 *
 * § 6 closes on the records lost at exit, and § 8 names the per-runtime
 * transports and the phone an operating system suspends without warning. A
 * reader who wires an observer to an audit or an experiment transport reads
 * neither spec, so the Observing page carries the drain shape and the member
 * carries the one-paragraph form of it.
 *
 * § 1 also sends the reader to a render site that writes the record, so the
 * Observing page's example reaches every field the prose beside it names. A
 * `useVariant` example reaches two of them and the prose names four, which sends
 * a reader to a hook that does not return what the paragraph asks for.
 *
 * § 4.2 requires the disclosure sentence where `observe` is introduced, because
 * a reader weighing `correlateBy` asks what the default sends off the box. The
 * library sends nothing, and the subject on an event is the value the
 * application put on its own `EvaluationContext` a moment earlier.
 *
 * The check reads phrases, not whole sentences. A phrase carries the claim and
 * survives an edit to the prose around it, and a whole-sentence match would
 * turn every rewording into a failure.
 *
 * § 4.3 calls the conditional freeze the least comfortable call it makes, and it
 * requires the reason at the member in the words the section uses: the freeze
 * adds 18 microseconds to a 23 microsecond call at forty features, and the
 * alternative is a freeze on every call. A reader who installs an observer and
 * then hits a frozen `resolve` result meets the asymmetry on three surfaces, and
 * none of the three leads to the other two, so each one carries the reason.
 *
 * § 4.3 also settles which options answer the mutable form, and the API
 * reference documents how a caller reaches it. An options object that omits
 * `observe` reaches it and an options object that names the member does not, so
 * the page states which annotation holds and which one does not typecheck. The
 * `createFeatures` docblock and the `UnobservedOptions` docblock answer the same
 * question for a reader hovering the symbol, and `observe.test-d.ts` pins both
 * failure modes, so each docblock carries the rule the type tests hold. The page
 * also reports where the compiler puts a misspelled option's error, because a
 * reader who expects the diagnostic on the property looks for a squiggle that is
 * on the callee.
 *
 * § 5 measures the engine's own guard and requires the measurement beside the
 * latency argument, because a reader who benchmarks a blocking observer sees the
 * transport dominate the call and attributes that time to the library. The
 * Observing page, the member and the API reference entry all argue the latency,
 * so all three carry the measurement and all three carry the figure.
 *
 * The scope is this one seam. A general rule that documentation carries every
 * sentence a spec asks for has no way to find the placements, and the spec names
 * each one itself.
 */

/** The spec section each notice answers, where it sits, and the phrases that carry its claim. */
const NOTICES = [
  {
    what: 'the exposure warning on the `observe` member',
    spec: '§ 1',
    file: 'libs/feature/src/lib/observe.ts',
    from: '   * Called once per public entry point call',
    until: '  observe?: (event',
    phrases: [
      'does not count exposures',
      'the request never rendered',
      'look plausible and are wrong',
      'at its render site',
    ],
  },
  {
    what: 'the exposure warning on the API reference entry',
    spec: '§ 1',
    file: 'apps/docs/content/feature/api.mdx',
    from: '### `FeatureOptions<S>`',
    until: '### `FrozenWhenObserved',
    phrases: [
      'does not count exposures',
      'the request never rendered',
      'look plausible and are wrong',
      'at its render site',
    ],
  },
  {
    what: 'the loss-at-exit note on the `observe` member',
    spec: '§ 6',
    file: 'libs/feature/src/lib/observe.ts',
    from: '   * Called once per public entry point call',
    until: '  observe?: (event',
    phrases: [
      'lost at exit',
      'gone when the process exits',
      'suspends a process without warning',
      'on `SIGTERM` and on the background transition',
    ],
  },
  {
    what: 'the loss-at-exit note on the API reference entry',
    spec: '§ 6',
    file: 'apps/docs/content/feature/api.mdx',
    from: '### `FeatureOptions<S>`',
    until: '### `FrozenWhenObserved',
    phrases: [
      'lost at exit',
      'suspends a process without warning',
      '`navigator.sendBeacon` on `visibilitychange`',
      '/feature/observing#records-in-flight-are-lost-at-exit',
    ],
  },
  {
    what: 'the drain shape on the Observing page',
    spec: '§ 8',
    file: 'apps/docs/content/feature/observing.mdx',
    from: '## Records in flight are lost at exit',
    until: '## `correlateBy`',
    phrases: [
      'gone when the process exits',
      'drains that buffer at a concurrency it owns',
      'drains on `SIGTERM`',
      '`navigator.sendBeacon`',
      'persists across a process restart',
      'suspends a process without warning',
      'declares no `drain()`',
    ],
  },
  {
    what: "the guard's measurement on the Observing page",
    spec: '§ 5',
    file: 'apps/docs/content/feature/observing.mdx',
    from: '## An observer never awaits and never changes an outcome',
    until: '## When an observer throws',
    phrases: [
      'the bare call ran at 23 microseconds',
      'accounts for that difference',
      'stay within run-to-run noise of the bare call',
      'the number anyone should care about is what their own hook body does',
    ],
  },
  {
    what: "the guard's measurement on the `observe` member",
    spec: '§ 5',
    file: 'libs/feature/src/lib/observe.ts',
    from: '   * Called once per public entry point call',
    until: '  observe?: (event',
    phrases: [
      'the bare call ran at 23 microseconds',
      'accounts for that difference',
      'stay within run-to-run noise of the bare call',
      'the number anyone should care about is what their own hook body does',
    ],
  },
  {
    what: "the guard's measurement on the API reference entry",
    spec: '§ 5',
    file: 'apps/docs/content/feature/api.mdx',
    from: '### `FeatureOptions<S>`',
    until: '### `FrozenWhenObserved',
    phrases: [
      'the bare call ran at 23 microseconds',
      'accounts for that difference',
      'stay within run-to-run noise of the bare call',
      'the number anyone should care about is what their own hook body does',
    ],
  },
  {
    what: "the freeze asymmetry's reason on the `observe` member",
    spec: '§ 4.3',
    file: 'libs/feature/src/lib/observe.ts',
    from: '   * Called once per public entry point call',
    until: '  observe?: (event',
    phrases: [
      'behaves differently under two configurations',
      'adds 18 microseconds',
      'whether or not they observe anything',
      'the freeze protects nothing there',
    ],
  },
  {
    what: "the freeze asymmetry's reason on the API reference entry",
    spec: '§ 4.3',
    file: 'apps/docs/content/feature/api.mdx',
    from: '### `FrozenWhenObserved',
    until: '### `FeatureKey` and `Instant`',
    phrases: [
      'behaves differently under two configurations',
      'adds 18 microseconds',
      'whether or not they observe anything',
      'the freeze protects nothing there',
    ],
  },
  {
    what: "the freeze asymmetry's reason on the Observing page",
    spec: '§ 4.3',
    file: 'apps/docs/content/feature/observing.mdx',
    from: '## An observer never awaits and never changes an outcome',
    until: '## When an observer throws',
    phrases: [
      'behaves differently under two configurations',
      'adds 18 microseconds',
      'whether or not they observe anything',
      'the freeze protects nothing there',
    ],
  },
  {
    what: 'the options that answer the mutable form, on the API reference entry',
    spec: '§ 4.3',
    file: 'apps/docs/content/feature/api.mdx',
    from: 'A call whose options settle neither question',
    until: '## `Features<S>`',
    phrases: [
      'leaving `observe` out of the options altogether',
      'works only against the pair that takes a named schema',
      'does not typecheck',
      'branches on the parameter',
    ],
  },
  {
    what: 'the mutable form, on the `createFeatures` docblock',
    spec: '§ 4.3',
    file: 'libs/feature/src/lib/features.ts',
    from: ' * A call whose options settle neither question answers the frozen form.',
    until: ' * The signature count stops at three.',
    phrases: [
      'leaving `observe` out of the options altogether',
      'only through the pair that takes a named schema',
      'reads the key and never the value',
      'cannot write the annotation at all',
    ],
  },
  {
    what: 'the mutable form, on the `UnobservedOptions` docblock',
    spec: '§ 4.3',
    file: 'libs/feature/src/lib/observe.ts',
    from: ' * The options of a call that provably installs no observer.',
    until: 'export type UnobservedOptions',
    phrases: [
      'The pair of signatures that takes a named schema selects on this type',
      'names `observe` at all',
      'even though it satisfies this type',
      'reach the mutable form on both paths',
    ],
  },
  {
    what: "the misspelled option's diagnostic, on the API reference entry",
    spec: '§ 4.3',
    file: 'apps/docs/content/feature/api.mdx',
    from: "`O`'s constraint,",
    until: 'The pair below it exists',
    phrases: [
      'anchors that error on the `createFeatures` callee and names no property',
      'TS2769: No overload matches this call',
      'Record<"observ", never>',
      'inside that printed signature',
    ],
  },
  {
    what: 'the exposure example on the Observing page',
    spec: '§ 1',
    file: 'apps/docs/content/feature/observing.mdx',
    from: 'So the application records exposure where it renders',
    until: '## What the seam does cover',
    phrases: [
      "const decision = useFeature('checkout-cta');",
      'decision.assignment?.source',
      'decision.assignment?.bucket',
      '`useFeature` returns the whole decision',
      '`useVariant` returns `variant` and `value` alone',
    ],
  },
  {
    what: 'the disclosure sentence beside `correlateBy`',
    spec: '§ 4.2',
    file: 'apps/docs/content/feature/observing.mdx',
    from: '## `correlateBy` and what reaches an event',
    until: '## Exposure tracking',
    phrases: [
      'sends nothing upstream',
      'put on its own `EvaluationContext`',
      'returns a caller its own data discloses nothing',
      'forwards the event off the box',
    ],
  },
] as const;

/**
 * The text between one marker and the next, which is where a notice belongs.
 *
 * The passage comes back on one line with its comment markers dropped. Prettier
 * wraps prose at eighty columns in both an `.mdx` page and a doc comment, so a
 * phrase a reader sees whole sits across two lines in the file.
 */
function passage(file: string, from: string, until: string): string {
  const source = readFileSync(join(workspaceRoot, file), 'utf8');
  const start = source.indexOf(from);
  if (start === -1) throw new Error(`${file} no longer carries ${from}`);
  const end = source.indexOf(until, start + from.length);
  if (end === -1) throw new Error(`${file} no longer carries ${until}`);
  return source
    .slice(start, end)
    .replace(/^\s*\*[ \t]?/gm, '')
    .replace(/\s+/g, ' ');
}

describe.each(NOTICES)('$what', ({ file, from, until, phrases }) => {
  it.each(phrases)('carries "%s"', (phrase) => {
    const text = passage(file, from, until);

    expect(text).toContain(phrase);
  });
});

/**
 * The docblock above names a spec section per notice, so a reader who adds a
 * notice for a new section finds the section listed or fails here. A count
 * written in prose drifts the moment someone adds a placement, and this case
 * fails on the drift.
 */
describe('the docblock', () => {
  const source = readFileSync(
    join(workspaceRoot, 'tools/repo-checks/src/doc-observer-notices.test.ts'),
    'utf8',
  );
  const docblock = source.slice(0, source.indexOf('const NOTICES'));
  const sections = [...new Set(NOTICES.map((notice) => notice.spec))];

  it.each(sections)('names %s', (spec) => {
    expect(docblock).toContain(spec);
  });
});
