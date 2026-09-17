import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';

/**
 * The prose word count of a docs page, which is what
 * `docs/specs/2026-09-16-documentation-standard.md` § 5 puts a budget on.
 *
 * Prose is what a reader reads as sentences. What comes out first is
 * everything the page carries that is not that:
 *
 * - Frontmatter, which is metadata.
 * - Fenced blocks. § 5 is explicit that the budget counts prose and not
 *   generated signatures, and a `file=` fence's body is not in the `.mdx` at
 *   all -- the region loader fills it at build -- so counting fences would
 *   make the number depend on where an example came from.
 * - MDX module scope: the `import` and `export` lines above the page.
 * - JSX tags, keeping what sits between them, because a `<Callout>` holds a
 *   sentence.
 * - MDX comments, and the URL half of a link.
 *
 * Splitting on whitespace after that counts a backticked symbol as the one
 * word it reads as.
 */
export function proseWords(source: string): number {
  const prose = source
    .replace(/^---\n.*?\n---\n/s, '')
    .replace(/^(\s*)(`{3,})[^\n]*\n.*?^\s*\2[^\n]*$/gms, '')
    .replace(/^(import|export)\s[^\n]*$/gm, '')
    .replace(/\{\/\*.*?\*\/\}/gs, '')
    .replace(/<!--.*?-->/gs, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<[^>]+>/g, ' ');

  return prose.split(/\s+/).filter(Boolean).length;
}

/** Every page under `apps/docs/content`, workspace-relative, with its count. */
export function proseCounts(): Map<string, number> {
  const content = join(workspaceRoot, 'apps/docs/content');

  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.mdx') ? [path] : [];
    });

  return new Map(
    walk(content).map((page) => [
      relative(workspaceRoot, page),
      proseWords(readFileSync(page, 'utf8')),
    ]),
  );
}
