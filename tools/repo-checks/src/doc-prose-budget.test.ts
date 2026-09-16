import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { proseCounts } from './doc-prose-budget.js';

/**
 * G8 of `docs/specs/2026-09-16-documentation-standard.md` § 12: the prose
 * budget, 1,200 words a page.
 *
 * § 5 states what the number is for. A page over it is two reader questions
 * sharing a URL, so the search result and the table of contents both point at
 * the wrong half. The guard counts and it cannot say which half to move, which
 * is why § 12 calls it the least valuable of the nine.
 *
 * `doc-prose-budget.json` is the allowance, and it is the whole mechanism: a
 * page already over budget carries its current count, the guard fails when that
 * count goes up, and the number only ever gets edited downwards. A reviewer
 * reads the ratchet off the diff of that file.
 *
 * An allowance is removed rather than lowered once its page is under budget, so
 * a page that comes back over has to be argued for again.
 */

const BUDGET = 1200;
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-prose-budget.json',
);

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  number
>;

describe('the prose budget', () => {
  const counts = proseCounts();

  it('counts the pages', () => {
    expect(counts.size).toBeGreaterThan(0);
  });

  it('holds every page to 1,200 words, or to a recorded allowance', () => {
    const over: string[] = [];

    for (const [page, words] of counts) {
      const allowed = allowance[page];

      if (allowed === undefined) {
        if (words > BUDGET) {
          over.push(`${page}: ${words} words, budget ${BUDGET}`);
        }
      } else if (words > allowed) {
        over.push(`${page}: ${words} words, allowance ${allowed}`);
      }
    }

    expect(
      over.sort(),
      'A page over 1,200 words of prose is two reader questions sharing a ' +
        'URL. Split it, or move the second question to its own page. The ' +
        'allowance in tools/repo-checks/src/doc-prose-budget.json only goes ' +
        'down.',
    ).toEqual([]);
  });

  it('carries no allowance a page has stopped needing', () => {
    const stale = Object.keys(allowance).filter((page) => {
      const words = counts.get(page);
      return words === undefined || words <= BUDGET;
    });

    expect(
      stale.sort(),
      'Remove these from tools/repo-checks/src/doc-prose-budget.json. The ' +
        'page is under budget or gone, and an allowance left behind is ' +
        'room the next edit can spend.',
    ).toEqual([]);
  });
});
