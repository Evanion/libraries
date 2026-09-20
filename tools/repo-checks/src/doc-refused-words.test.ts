import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * No page tells a reader the thing they are stuck on is easy.
 *
 * Decision 15 of `docs/specs/2026-09-20-public-documentation-guidance.md`.
 * GitLab's word list and Google's Voice and tone both refuse these, for the
 * same reason: a reader who has just failed at the step reads `simply` as a
 * verdict on them. `please` and `and/or` are refused on the same lists,
 * `please` because a manual is not asking a favour and `and/or` because the
 * reader has to work out which.
 *
 * `note that` is refused because the words carry nothing. Every sentence on the
 * page is there to be noted, and the phrase is a throat-clear before the one
 * fact the sentence holds.
 *
 * `simple` and `easy` are on the public lists too, and are NOT checked here.
 * `acl/simple.mdx` is a slug a reader has bookmarked, the word is a legitimate
 * description of a thing that genuinely has few parts, and a pattern cannot
 * tell that use from the dismissive one. Those two are the reviewer's, under
 * the same decision.
 *
 * Prose only. A fence can carry any of these in a string or a comment, a table
 * cell is not a sentence, and an import line is not prose.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');

/** Refused outright, with the reason each one is refused. */
const REFUSED: readonly { pattern: RegExp; instead: string }[] = [
  {
    pattern: /\bsimply\b/i,
    instead: 'cut it; the sentence states the step without it',
  },
  {
    pattern: /\beasily\b/i,
    instead: 'cut it, or say what makes it cheap',
  },
  {
    pattern: /\bquickly\b/i,
    instead: 'cut it, or name the number',
  },
  {
    pattern: /\bplease\b/i,
    instead: 'cut it; an instruction is not a favour',
  },
  {
    pattern: /\band\/or\b/i,
    instead: 'say which, or say both',
  },
  {
    pattern: /\bnote that\b/i,
    instead: 'cut it and keep the fact that follows',
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
  it('does not tell a reader the step they are on is easy', () => {
    const found: string[] = [];

    for (const page of mdxFiles(CONTENT)) {
      const source = readFileSync(page, 'utf8');
      const relative = page.slice(workspaceRoot.length + 1);

      for (const { line, text } of prose(source)) {
        for (const { pattern, instead } of REFUSED) {
          const hit = pattern.exec(text);
          if (hit) found.push(`${relative}:${line}: "${hit[0]}" -- ${instead}`);
        }
      }
    }

    expect(found.sort()).toEqual([]);
  });
});
