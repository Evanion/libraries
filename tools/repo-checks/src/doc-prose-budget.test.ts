import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { proseCounts } from './doc-prose-budget.js';

/**
 * G8 of `docs/specs/2026-09-16-documentation-standard.md` § 12: the prose
 * budget, 1,200 words a page. A guideline, and this reports rather than fails.
 *
 * § 5 states what the number is for. A page over it is often two reader
 * questions sharing a URL, so the search result and the table of contents both
 * point at the wrong half. The count cannot say which half to move, which is
 * why § 12 calls it the least valuable of the nine guards.
 *
 * It does not fail a build, because the number is a prompt to ask whether a
 * page has become two, and an answer of "no, this one earns its length" is
 * legitimate. Failing on it buys shorter sentences and not better pages: an
 * author fifteen words over trims a gloss that was doing work, which is a worse
 * page than the one the budget was written to prevent.
 *
 * `doc-prose-budget.json` records the pages already over, so the report names
 * only what is newly over and a reviewer reads the change off that file.
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

  it('reports the pages over 1,200 words', () => {
    const over: string[] = [];

    for (const [page, words] of counts) {
      const recorded = allowance[page];
      if (words <= BUDGET) continue;
      if (recorded !== undefined && words <= recorded) continue;
      over.push(`${page}: ${words} words, budget ${BUDGET}`);
    }

    if (over.length > 0) {
      console.warn(
        `\n${over.length} page(s) over the ${BUDGET}-word prose guideline:\n` +
          `${over
            .sort()
            .map((line) => `  ${line}`)
            .join('\n')}\n` +
          'Ask whether the page has become two reader questions. If it has, ' +
          'move the second to its own page. If it has not, record the count ' +
          'in tools/repo-checks/src/doc-prose-budget.json and carry on.\n',
      );
    }

    expect(counts.size).toBeGreaterThan(0);
  });
});
