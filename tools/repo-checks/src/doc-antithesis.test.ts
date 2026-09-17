import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * No page states a thing by first stating its opposite.
 *
 * "The thing that separates you is not who you are but which review is on the
 * screen" carries one fact and makes a reader hold two. The house style has
 * ruled it out since before any of these pages were written, and it kept
 * arriving anyway -- three times in one sitting, twice in sentences written to
 * replace an earlier one removed for the same reason. A rule nobody can follow
 * from memory is a rule that wants a test.
 *
 * Only the shape with near-zero false positives is checked: a negation and its
 * `but` inside one sentence. "Rather than" and "instead of" are the same figure
 * and are left to a reviewer, because both have honest uses that a pattern
 * cannot tell from the dishonest ones.
 *
 * Prose only. Code fences carry `!==` and comments of their own, tables carry
 * cell text that is not a sentence, and neither reads as an argument.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');

/** A negation and a `but` in the same sentence, with the two close enough to pair. */
const ANTITHESIS = /\bnot\b[^.!?;:]{2,60}?\bbut\b/i;

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
  it('states what is so without first stating what is not', () => {
    const found: string[] = [];

    for (const page of mdxFiles(CONTENT)) {
      const source = readFileSync(page, 'utf8');
      const relative = page.slice(workspaceRoot.length + 1);

      // Joined across lines, because the construction survives a wrap.
      const paragraphs: { line: number; text: string }[] = [];
      let open: { line: number; text: string } | null = null;

      for (const { line, text } of prose(source)) {
        if (text.trim() === '') {
          if (open) paragraphs.push(open);
          open = null;
          continue;
        }
        open = open
          ? { line: open.line, text: `${open.text} ${text.trim()}` }
          : { line, text: text.trim() };
      }
      if (open) paragraphs.push(open);

      for (const { line, text } of paragraphs) {
        for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          if (ANTITHESIS.test(sentence)) {
            found.push(`${relative}:${line}: ${sentence.trim()}`);
          }
        }
      }
    }

    expect(found).toEqual([]);
  });
});
