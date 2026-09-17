import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { markListings } from '../../tools/mdx-listing-loader.mjs';

/**
 * The mark documentation standard § 5 makes a condition of its exemption tags.
 *
 * § 5 grants five tags that let a fence out of the executed-region rule, and in
 * the same paragraph says the site "needs" a rendered mark "before the
 * exemptions are safe to grant", because a reader cannot otherwise tell a
 * hand-written fence from an executed one. The loader is what puts it there and
 * this is what holds it to every tagged fence on the site.
 */

const CONTENT = join(import.meta.dirname, '../../content');
const TAGGED =
  /^```[^\n]*\b(signature|no-run|anti-example|fails-type-check|elided)\b/gm;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

describe('the listing mark', () => {
  it('wraps a tagged fence and leaves the fence itself alone', () => {
    const expanded = markListings('```astro no-run\n<slot />\n```\n');

    expect(expanded).toContain('<Listing mark="no-run">');
    expect(expanded).toContain('```astro no-run');
    expect(expanded).toContain('</Listing>');
  });

  it('leaves an untagged fence alone', () => {
    const source = '```ts\nconst a = 1;\n```\n';

    expect(markListings(source)).toBe(source);
  });

  it('leaves a tagged fence quoted inside a longer fence alone', () => {
    const source = '````md\n```ts no-run\nconst a = 1;\n```\n````\n';

    expect(markListings(source)).toBe(source);
  });

  it('marks a fence carrying the tag beside a language and a file', () => {
    expect(
      markListings('```ts signature file=x.ts\ndeclare const a: 1;\n```\n'),
    ).toContain('<Listing mark="signature">');
  });

  it('reaches every tagged fence on the site', () => {
    const unmarked: string[] = [];

    for (const page of mdxFiles(CONTENT)) {
      const source = readFileSync(page, 'utf8');
      const tagged = [...source.matchAll(TAGGED)].length;
      if (tagged === 0) continue;

      const marks = [...markListings(source).matchAll(/<Listing mark="/g)]
        .length;

      if (marks !== tagged) {
        unmarked.push(
          `${relative(CONTENT, page)}: ${tagged} tagged fences, ${marks} marks`,
        );
      }
    }

    expect(
      unmarked.sort(),
      "A fence carrying one of documentation standard § 5's exemption tags " +
        'has to reach the reader with the mark that says so. Check ' +
        'tools/mdx-listing-loader.mjs against the fence.',
    ).toEqual([]);
  });
});
