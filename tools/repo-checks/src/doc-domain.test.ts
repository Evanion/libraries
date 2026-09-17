import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';

/**
 * G9 of `docs/specs/2026-09-16-documentation-standard.md` § 12: the abandoned
 * domain stays abandoned.
 *
 * § 6 puts every example in one domain, the game shop, because vocabulary that
 * survives a section boundary is the one thing a journey inside one section
 * cannot buy. This guard is the half of that a test can reach: it names the
 * five nouns the site left behind -- `post`, `comment`, `invoice`, `article`,
 * `blog` -- and fails a section that still uses one as a domain object.
 *
 * Its limit is the one § 12 states and is worth restating here, because a
 * passing run reads stronger than it is: a deny list proves an example left the
 * old domain and can never prove it arrived in the new one. Whether an example
 * is set in the shop is a reading, and it is the reviewer's.
 *
 * **Only code is read.** The pages are full of "the handler the button posts
 * to" and "every implementation says in its own comments", and no deny list
 * separates those from `type: 'post'`. So the scan runs over fenced blocks
 * after the region loader has filled them -- which is the source a reader
 * copies, and the only place a domain object can actually appear -- and over no
 * prose at all. A stale paragraph naming a removed noun is the residue sweep in
 * `.claude/agents/docs-reviewer.md`, not this.
 *
 * `domainExempt` on the `navigation.ts` entry is the escape § 6 names, for a
 * package whose subject has no shop object in it. `compose` carries the only
 * one: its subject is the nesting of a provider tree, and a cart in the middle
 * of a type failure adds a word per line and no meaning.
 *
 * A ratchet like G3's rather than a pass/fail, on the same mechanism: a section
 * records what it still carries and the number only goes down.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-domain-allowance.json',
);

/** The nouns § 12 names, as whole words and in any case. */
const ABANDONED = /\b(post|comment|invoice|article|blog)s?\b/gi;

/**
 * Two spellings that are not domain objects and never will be.
 *
 * `<article>` is an HTML element, and it is the correct element for a card;
 * `method="post"` is an HTTP verb. Both are permanent, both would otherwise
 * make this guard fail forever on a page that has nothing left to rename, and
 * the fix it would push a writer towards -- a `<div>` where the markup wants a
 * landmark -- is worse than the thing it is guarding against.
 *
 * Stripped before the match rather than exempted after it, so the count these
 * tests report is the count a reviewer would make by hand.
 */
const NOT_A_DOMAIN_OBJECT = [
  /<\/?article\b/gi,
  /\bmethod\s*[=:]\s*['"]?post['"]?/gi,
];

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  number
>;

interface DocumentedPackage {
  slug: string;
  documented: boolean;
  domainExempt?: string;
}

async function exemptSections(): Promise<Set<string>> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };

  return new Set(
    module_.packages
      .filter((entry) => entry.domainExempt !== undefined)
      .map((entry) => entry.slug),
  );
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * The body of every fence in one document, with `file=` fences filled.
 *
 * A `file=… region=…` fence is empty in the `.mdx` -- the region loader fills
 * it at build -- so reading the page as written would scan nothing for exactly
 * the examples that execute, which are the ones the domain rule is about.
 */
function fencedCode(source: string, page: string): string[] {
  const filled = expandRegions(source, workspaceRoot, page) as string;
  const blocks: string[] = [];
  let open: string | null = null;
  let body: string[] = [];

  for (const line of filled.split('\n')) {
    const marker = line.match(/^\s*(`{3,})(.*)$/);

    if (marker !== null && open === null) {
      open = marker[1] as string;
      body = [];
      continue;
    }

    if (open === null) continue;

    if (marker !== null && (marker[1] as string).startsWith(open)) {
      blocks.push(body.join('\n'));
      open = null;
      continue;
    }

    body.push(line);
  }

  return blocks;
}

/** Every section under `content/`, with the abandoned nouns its code still has. */
function tally(): Map<string, number> {
  const sections = new Map<string, number>();

  for (const page of mdxFiles(CONTENT)) {
    const section = relative(CONTENT, page).split(sep)[0] as string;
    const source = readFileSync(page, 'utf8');
    const code = NOT_A_DOMAIN_OBJECT.reduce(
      (text, pattern) => text.replace(pattern, ''),
      fencedCode(source, page).join('\n'),
    );
    const found = code.match(ABANDONED);

    sections.set(section, (sections.get(section) ?? 0) + (found?.length ?? 0));
  }

  return sections;
}

describe('the abandoned domain', () => {
  it('reads a section that exists', () => {
    expect(existsSync(CONTENT)).toBe(true);
    expect(tally().size).toBeGreaterThan(0);
  });

  it('stays out of every section that is not exempt', async () => {
    const exempt = await exemptSections();
    const carrying: string[] = [];

    for (const [section, found] of tally()) {
      if (exempt.has(section)) continue;

      const allowed = allowance[section] ?? 0;
      if (found > allowed) {
        carrying.push(`${section}: ${found} occurrences, allowance ${allowed}`);
      }
    }

    expect(
      carrying.sort(),
      'A fence, or a region a page renders, still names one of post, comment, ' +
        'invoice, article or blog. Documentation standard § 6 maps each to a ' +
        'shop noun. Rename it, or record a `domainExempt` reason on the ' +
        "section's navigation.ts entry. The allowance in " +
        'tools/repo-checks/src/doc-domain-allowance.json only goes down.',
    ).toEqual([]);
  });

  it('leaves no allowance larger than the section needs', () => {
    const counts = tally();
    const slack: string[] = [];

    for (const [section, allowed] of Object.entries(allowance)) {
      const found = counts.get(section);

      if (found === undefined) {
        slack.push(`${section}: no such section`);
        continue;
      }

      if (found < allowed) {
        slack.push(`${section}: ${found} left, allowance ${allowed}`);
      }
    }

    expect(
      slack.sort(),
      'Lower these in tools/repo-checks/src/doc-domain-allowance.json, and ' +
        'remove the entry at zero.',
    ).toEqual([]);
  });

  it('exempts no section that also records an allowance', async () => {
    const exempt = await exemptSections();
    const both = Object.keys(allowance).filter((section) =>
      exempt.has(section),
    );

    expect(
      both.sort(),
      'A `domainExempt` says the section keeps its own vocabulary and an ' +
        'allowance says it is on its way to the shop. Drop one.',
    ).toEqual([]);
  });
});
