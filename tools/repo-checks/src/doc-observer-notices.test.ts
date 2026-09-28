import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * Two claims `docs/specs/2026-09-23-feature-observation-seam.md` puts on the
 * documentation itself, read back where the spec puts them.
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
 * § 4.2 requires the disclosure sentence where `observe` is introduced, because
 * a reader weighing `correlateBy` asks what the default sends off the box. The
 * library sends nothing, and the subject on an event is the value the
 * application put on its own `EvaluationContext` a moment earlier.
 *
 * The check reads phrases, not whole sentences. A phrase carries the claim and
 * survives an edit to the prose around it, and a whole-sentence match would
 * turn every rewording into a failure.
 *
 * The scope is this one seam. A general rule that documentation carries every
 * sentence a spec asks for has no way to find the pairs, and the spec names
 * these two placements itself.
 */

/** Where each notice sits, and the phrases that carry its claim. */
const NOTICES = [
  {
    what: 'the exposure warning on the `observe` member',
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
    what: 'the disclosure sentence beside `correlateBy`',
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
