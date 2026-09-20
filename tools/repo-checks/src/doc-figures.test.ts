import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * No page states a fact as a figure of speech.
 *
 * A matrix was documented as something that "outlives its process". The library
 * writes no file and reads none, so the sentence was false, and it survived a
 * documentation review, a prose rewrite, a density pass and several readings.
 *
 * A figure does not read like a claim, so nobody checks it against the source.
 * "The library persists the matrix to disk" states the same thing and would
 * have been caught at once. That is what makes this a correctness rule rather
 * than a matter of taste: a metaphor carries a claim past review, and the
 * claim can be wrong.
 *
 * Only phrases with near-zero false positives are listed. The metaphor verbs
 * the house style also refuses -- `ships`, `lands`, `survives` -- are left to a
 * reviewer, because this repository uses all three literally: a page ships, a
 * byte lands in the biased tail of a range, and a value survives a JSON round
 * trip. `buys` has no literal use here, because nothing in these packages
 * purchases anything.
 *
 * The list is a ratchet. A figure found in review is added with the sentence it
 * came from, so the next author meets it as a test rather than as taste.
 *
 * Prose only. A fence carries identifiers and comments of its own, a table cell
 * is not a sentence, and an import line is not prose.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');

/** Refused, with what the sentence should state instead. */
const FIGURES: readonly { pattern: RegExp; instead: string }[] = [
  {
    pattern: /\bbuys\b/i,
    instead: 'name what it gives the reader, or what it costs them',
  },
  {
    pattern: /\bcosts you\b/i,
    instead: 'name the cost: a call, a fetch, a rebuild',
  },
  {
    pattern: /\boutlive[sd]?\b/i,
    instead:
      'say what crosses and how. Nothing here persists, so a document does not outlive anything',
  },
  {
    pattern: /\bunder the hood\b/i,
    instead: 'name the function that does it',
  },
  {
    pattern: /\bout of the box\b/i,
    instead: 'say what the package exports, and what a caller writes',
  },
  {
    pattern: /\bheavy lifting\b/i,
    instead: 'name the work and what does it',
  },
  {
    pattern: /\bsilver bullet\b/i,
    instead: 'say which case it does not cover',
  },
  {
    pattern: /\bboils down to\b/i,
    instead: 'state the thing it reduces to',
  },
  {
    pattern: /\bgives the game away\b/i,
    instead: 'say what is disclosed, to whom, and when',
  },
  {
    pattern: /\bin your hands\b/i,
    instead: 'name the value the caller holds',
  },
];

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** The page's prose: no fences, no tables, no import lines. */
function prose(source: string): { line: number; text: string }[] {
  const lines = source.split('\n');
  const out: { line: number; text: string }[] = [];
  let fenced = false;

  for (const [index, line] of lines.entries()) {
    if (/^\s*`{3,}/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (/^\s*\|/.test(line)) continue;
    if (/^\s*import\s/.test(line)) continue;
    out.push({ line: index + 1, text: line });
  }

  return out;
}

describe('documentation prose', () => {
  it('states a fact rather than a figure of speech', () => {
    const found: string[] = [];

    for (const page of mdxFiles(CONTENT)) {
      const source = readFileSync(page, 'utf8');
      const relative = page.slice(workspaceRoot.length + 1);

      for (const { line, text } of prose(source)) {
        for (const { pattern, instead } of FIGURES) {
          const hit = pattern.exec(text);
          if (hit) found.push(`${relative}:${line}: "${hit[0]}" -- ${instead}`);
        }
      }
    }

    expect(found.sort()).toEqual([]);
  });
});
