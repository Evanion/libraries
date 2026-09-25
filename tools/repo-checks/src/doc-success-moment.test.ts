import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseRegions, readValueClaim } from '@evanion/doc-examples';
import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G11 of `docs/specs/2026-09-25-documentation-standard.md` § 6 and § 14: a page
 * whose reader builds something shows them a result.
 *
 * § 6's rule is that a reader sees a result rather than a description of one,
 * and its strongest form is a `// -> value` claim inside an executed region:
 * `tools/doc-examples/src/expect-comments.ts` rewrites the claim into an
 * `expect().toEqual()` that the package's own test run executes, so the page
 * renders the readable form and CI holds the value.
 *
 * One role carries the obligation a value claim is the right evidence for:
 * `getting-started.mdx`, whose whole job § 3 states as a first working result.
 * Every other page's obligation follows its band, and § 6 leaves that half to
 * `.claude/agents/docs-reviewer.md`.
 *
 * **The demonstration page is not read here, and § 6 says why.** Its result is a
 * control the reader operates, which § 6 counts as a success moment, and
 * `doc-control.test.ts` requires that control on the page the `demo` field names,
 * off the same field, failing the build without it. Asking the same page for a
 * `// -> value` claim asks twice for one result and gets the weaker answer the
 * second time: `react-widget/playground` mounts `DataDemo` and
 * `PlaygroundExamples`, and a claim pasted onto it to satisfy a guard is the
 * padding § 6 names as the defect.
 *
 * **The band extension in § 6 is not implemented.** It needs a closed band-key
 * vocabulary across the site, and only `apps/docs/content/acl/_meta.ts` carries
 * separators today, with the keys `group-setup`, `group-platforms`,
 * `group-questions` and `group-reference`. A rule written against those keys
 * would be derived from a sample of one section in twelve, so it waits for a
 * second section to earn bands.
 *
 * **A page that does not exist is not a failure here.** `doc-floor.test.ts` owns
 * page presence and `doc-floor-allowance.json` already records `acl`, `luhn` and
 * `token` as short of `getting-started`. A role with no page is skipped, so one
 * gap fails one guard and the report names the thing to write once.
 *
 * The claim test is the repository's own scanner, so the guard and CI answer "is
 * this line a claim" with the same code. `readValueClaim` is the exported form
 * of that scan -- it runs the `indexOfLineComment` walk, which knows that a `//`
 * inside a string is not a comment, and then tests the comment for the `->`
 * marker. Nothing here re-implements either half.
 *
 * `successExempt` on the `navigation.ts` entry is the escape, a non-empty string
 * carrying the reason, on the pattern `demoExempt` and `domainExempt` already
 * set. `doc-success-moment-allowance.json` is the ratchet, keyed by section and
 * holding the roles that do not satisfy the rule yet, on
 * `doc-floor-allowance.json`'s list-valued shape. A section may not be both
 * exempt and allowed: an exemption says the result is not coming and an
 * allowance says it is.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-success-moment-allowance.json',
);

/** The `navigation.ts` shape this guard reads, restated rather than imported.
 *
 * An `import type` across the project boundary would put an app's source into
 * this project's compilation, which its tsconfig does not include. */
interface DocumentedPackage {
  slug: string;
  documented: boolean;
  successExempt?: string;
}

/**
 * A fence citing a region.
 *
 * The two keys are matched anywhere in the info string rather than immediately
 * after the language, because a fence on this site carries `twoslash` between
 * them -- `urn/getting-started.mdx` writes
 * ```` ```ts twoslash file=… region=… ```` -- and a pattern anchored on the
 * language would read those three pages as showing no result at all.
 */
const REFERENCE = /^\s*`{3,}[^\n]*\bfile=(\S+)[^\n]*\bregion=([\w-]+)/gm;

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  string[]
>;

async function documentedSections(): Promise<DocumentedPackage[]> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };

  return module_.packages.filter((entry) => entry.documented);
}

/** The page a role names, or null when the section has not written it. */
function pagePath(slug: string, role: string): string | null {
  return (
    ['.mdx', '.md']
      .map((extension) => join(CONTENT, slug, `${role}${extension}`))
      .find((candidate) => existsSync(candidate)) ?? null
  );
}

/** Whether any line of a region body claims a value. */
function claimsValue(code: string): boolean {
  return code.split('\n').some((line) => readValueClaim(line) !== null);
}

/** Whether the page renders a region carrying a claim. */
function showsResult(page: string): boolean {
  const source = readFileSync(page, 'utf8');

  for (const [, file, name] of source.matchAll(REFERENCE)) {
    let contents: string;

    try {
      contents = readFileSync(join(workspaceRoot, file as string), 'utf8');
    } catch {
      // `doc-regions.test.ts` fails on a reference that resolves to nothing,
      // and a page whose region is missing owes that guard's fix rather than a
      // second report of the same defect here.
      continue;
    }

    const region = parseRegions(contents, file as string).get(name as string);

    if (region !== undefined && claimsValue(region.code)) return true;
  }

  return false;
}

/** The roles a value claim is asked for, as `_meta` keys. */
const OBLIGED = ['getting-started'];

/** The roles a section has written and which show no result. */
function silentRoles(entry: DocumentedPackage): string[] {
  return OBLIGED.filter((role) => {
    const page = pagePath(entry.slug, role);
    return page !== null && !showsResult(page);
  });
}

describe('the success moment', () => {
  it('finds the documented sections', async () => {
    expect((await documentedSections()).length).toBeGreaterThan(0);
  });

  it('is shown on every getting-started page', async () => {
    const silent: string[] = [];

    for (const entry of await documentedSections()) {
      if (entry.successExempt !== undefined) continue;
      const allowed = new Set(allowance[entry.slug] ?? []);

      for (const role of silentRoles(entry)) {
        if (!allowed.has(role)) silent.push(`${entry.slug}: ${role}`);
      }
    }

    expect(
      silent.sort(),
      'A getting-started page renders at least one `file=… region=…` fence ' +
        'whose region carries a `// -> value` claim, which is documentation ' +
        'standard § 6: the reader sees the result and the package test run ' +
        'holds it. Write the claim into the region, ' +
        'record a `successExempt` reason in apps/docs/app/navigation.ts, or ' +
        'record the wait in doc-success-moment-allowance.json.',
    ).toEqual([]);
  });

  it('records no role that now shows a result', async () => {
    const stale: string[] = [];

    for (const entry of await documentedSections()) {
      const silent = new Set(silentRoles(entry));

      for (const role of allowance[entry.slug] ?? []) {
        if (!silent.has(role)) stale.push(`${entry.slug}: ${role}`);
      }
    }

    expect(
      stale.sort(),
      'These are recorded in doc-success-moment-allowance.json and the page ' +
        'now shows a result. Remove the entry, so a page that loses the claim ' +
        'again has to be argued for rather than staying quietly allowed.',
    ).toEqual([]);
  });

  it('gives a reason with every exemption', async () => {
    const empty = (await documentedSections())
      .filter((entry) => entry.successExempt?.trim() === '')
      .map((entry) => entry.slug);

    expect(
      empty,
      'A `successExempt` is the reason a section shows its reader no result, ' +
        'written for the reviewer who asks why. An empty one records nothing.',
    ).toEqual([]);
  });

  it('exempts no section that also records a wait', async () => {
    const both = (await documentedSections())
      .filter((entry) => entry.successExempt !== undefined)
      .filter((entry) => entry.slug in allowance)
      .map((entry) => entry.slug);

    expect(
      both,
      'A `successExempt` says the result is not coming and an allowance says ' +
        'it is. Drop one.',
    ).toEqual([]);
  });
});
