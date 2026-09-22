import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * The `/testing` section renders every register entry, in the order its own
 * printed rule states, from the test that proves the entry.
 *
 * Three things could drift and none of them would fail a build. The page could
 * lose an entry the register gained. It could carry the cases in an order the
 * rule it prints does not produce, which is the cherry-picking a sceptic
 * assumes. And a case could point at the wrong tier file, which reads as a
 * register entry proved by a test that proves something else.
 *
 * So this reads `libs/acl/SECURITY.md`, ranks it with the same module the build
 * ranks it with, and holds the page's `<Case id=…>` blocks against the result.
 * `tools/repo-checks/src/security-register.test.ts` is the other half and holds
 * the register against the suite and against `/acl/register`; this one is about
 * the page that renders the cases.
 */

const PAGE = join(workspaceRoot, 'apps/docs/content/testing/index.mdx');
const REGISTER = join(workspaceRoot, 'libs/acl/SECURITY.md');
const REDUCTION = join(workspaceRoot, 'apps/docs/tools/statistics.mjs');
const SUITE = join(workspaceRoot, 'libs/acl/src/security');

interface Entry {
  id: string;
  tier: number;
}

async function ranked(): Promise<Entry[]> {
  const module_ = (await import(pathToFileURL(REDUCTION).href)) as {
    parseRegister: (markdown: string) => Entry[];
    rankEntries: (
      entries: Entry[],
      options: { generated: string[] },
    ) => Entry[];
  };

  const source = readFileSync(
    join(SUITE, 'tier1-prevented.test.ts'),
    'utf8',
  ).split('\n');
  const generated: string[] = [];
  let open: string | null = null;

  for (const line of source) {
    const heading = /^describe\('(SEC-\d+)/.exec(line);
    if (heading) open = heading[1] as string;
    if (open !== null && line.includes('new Gen(')) {
      generated.push(open);
      open = null;
    }
  }

  return module_.rankEntries(
    module_.parseRegister(readFileSync(REGISTER, 'utf8')),
    {
      generated,
    },
  );
}

/** Every `<Case id=…>` on the page, with the fence it wraps, in page order. */
function cases(): { id: string; file: string; region: string }[] {
  const source = readFileSync(PAGE, 'utf8').split('\n');
  const found: { id: string; file: string; region: string }[] = [];
  let open: string | null = null;

  for (const line of source) {
    const start = /^<Case id="(SEC-\d+)">$/.exec(line);
    if (start) open = start[1] as string;

    const fence = /^```ts file=(\S+) region=([\w-]+)$/.exec(line);
    if (fence && open !== null) {
      found.push({
        id: open,
        file: fence[1] as string,
        region: fence[2] as string,
      });
      open = null;
    }
  }

  return found;
}

/** Which tier file proves an identifier, from the identifier's own number. */
function tierFile(tier: number): string {
  return (
    {
      1: 'tier1-prevented.test.ts',
      2: 'tier2-primitives.test.ts',
      3: 'tier3-contract.test.ts',
    }[tier] ?? ''
  );
}

describe('the testing section', () => {
  it('renders every register entry, in the order its own rule produces', async () => {
    expect(existsSync(PAGE)).toBe(true);

    expect(
      cases().map((one) => one.id),
      'The page prints the rank rule above the cases, so the cases have to be ' +
        'in the order apps/docs/tools/statistics.mjs produces. Reorder the ' +
        '<Case> blocks, or change the rule and say so on the page.',
    ).toEqual((await ranked()).map((entry) => entry.id));
  });

  it('points each case at the tier file that proves it', async () => {
    const tiers = new Map(
      (await ranked()).map((entry) => [entry.id, entry.tier]),
    );
    const wrong: string[] = [];

    for (const one of cases()) {
      const expected = `libs/acl/src/security/${tierFile(tiers.get(one.id) ?? 0)}`;

      if (one.file !== expected) wrong.push(`${one.id}: ${one.file}`);
      if (one.region !== one.id.toLowerCase()) {
        wrong.push(`${one.id}: region ${one.region}`);
      }
    }

    expect(wrong.sort()).toEqual([]);
  });
});

describe('the kinds of test that live outside a library', () => {
  it('names a file that exists', async () => {
    const module_ = (await import(pathToFileURL(REDUCTION).href)) as {
      KINDS_OUTSIDE: { kind: string; file: string }[];
    };

    const gone = module_.KINDS_OUTSIDE.filter(
      (entry) => !existsSync(join(workspaceRoot, entry.file)),
    ).map((entry) => `${entry.kind}: ${entry.file}`);

    expect(
      gone.sort(),
      'The /testing page names these kinds and counts none of them, because ' +
        'no library vitest config can derive them. An entry whose file is ' +
        'gone is a claim the page makes about a test that no longer runs.',
    ).toEqual([]);
  });
});
