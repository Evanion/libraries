import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G2 of `docs/specs/2026-09-25-documentation-standard.md` § 14: the floor.
 *
 * Every documented section has an overview, a getting-started page, an API
 * reference, and a demonstration. The first three are filenames. The fourth is
 * a role — `usage`, `examples`, `components`, `playground`, `validation`,
 * `interface` — so nothing derives it from the content tree, and
 * `apps/docs/app/navigation.ts` carries it as `demo`. That field is also what
 * gives `doc-control.test.ts` its target.
 *
 * The four roles and the five-page allowance are § 7's carry-forward paragraph,
 * which keeps them from the old standard's § 4 because three guards read them:
 * a section of five pages or fewer may put the demonstration role on
 * `getting-started`, because below that a separate page splits a concept from
 * its own practice. Above five pages the role owes a page of its own, and this
 * guard holds that bound.
 *
 * `getting-started.mdx` is what § 3 makes stage 2 of a reader's journey: the
 * page that carries the prerequisites, the install command, the minimum
 * configuration that runs and one result the reader sees. So the page this
 * guard asks for is not a filename a table happened to name -- it is the one
 * page in a section where a reader has spent effort and received nothing yet,
 * and `doc-success-moment.test.ts` holds it to the result.
 *
 * `doc-floor-allowance.json` is the ratchet, on the same mechanism as
 * `doc-fence-allowance.json`: a section short of a floor page records which
 * role it is short of, the guard fails on anything not recorded, and an entry
 * is removed rather than edited once the page lands. § 15 is where the order
 * they come off in is written.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-floor-allowance.json',
);

/** The `navigation.ts` shape this guard reads, restated rather than imported.
 *
 * An `import type` across the project boundary would put an app's source into
 * this project's compilation, which its tsconfig does not include. */
interface DocumentedPackage {
  slug: string;
  documented: boolean;
  demo?: string;
}

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  string[]
>;

/** Below this a section may put the demonstration role on getting-started. */
const SMALL_SECTION = 5;

async function documentedSections(): Promise<DocumentedPackage[]> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };

  return module_.packages.filter((entry) => entry.documented);
}

/** Whether `content/<slug>/` carries the page a `_meta` key would name. */
function pageExists(slug: string, name: string): boolean {
  return ['.mdx', '.md'].some((extension) =>
    existsSync(join(CONTENT, slug, `${name}${extension}`)),
  );
}

/** How many pages a section has, which is what § 4's allowance turns on. */
function pageCount(slug: string): number {
  return readdirSync(join(CONTENT, slug)).filter(
    (name) => /\.mdx?$/.test(name) && !name.startsWith('_'),
  ).length;
}

/** The floor roles a section is short of, before the allowance is applied. */
function missingRoles(entry: DocumentedPackage): string[] {
  const missing: string[] = [];

  if (!pageExists(entry.slug, 'index')) missing.push('index');
  if (!pageExists(entry.slug, 'getting-started'))
    missing.push('getting-started');
  if (!pageExists(entry.slug, 'api')) missing.push('api');
  if (entry.demo === undefined || !pageExists(entry.slug, entry.demo)) {
    missing.push('demo');
  }

  return missing;
}

describe('the section floor', () => {
  it('finds the documented sections', async () => {
    expect((await documentedSections()).length).toBeGreaterThan(0);
  });

  it('gives every section an overview, a getting-started, an api and a demonstration', async () => {
    const short: string[] = [];

    for (const entry of await documentedSections()) {
      const allowed = new Set(allowance[entry.slug] ?? []);

      for (const role of missingRoles(entry)) {
        if (!allowed.has(role)) short.push(`${entry.slug}: ${role}`);
      }
    }

    expect(
      short.sort(),
      'Every documented section needs `index`, `getting-started`, `api` and ' +
        'the page its `demo` field names in apps/docs/app/navigation.ts. Write ' +
        'the page, or record the gap in doc-floor-allowance.json.',
    ).toEqual([]);
  });

  it('records no gap a section has already closed', async () => {
    const stale: string[] = [];

    for (const entry of await documentedSections()) {
      const missing = new Set(missingRoles(entry));

      for (const role of allowance[entry.slug] ?? []) {
        if (!missing.has(role)) stale.push(`${entry.slug}: ${role}`);
      }
    }

    expect(
      stale.sort(),
      'These are recorded in doc-floor-allowance.json and the page now ' +
        'exists. Remove the entry, so a section that loses the page again has ' +
        'to be argued for rather than staying quietly allowed.',
    ).toEqual([]);
  });

  it('gives a section of more than five pages a demonstration page of its own', async () => {
    const wrong: string[] = [];

    for (const entry of await documentedSections()) {
      if (entry.demo !== 'getting-started') continue;
      const pages = pageCount(entry.slug);
      if (pages > SMALL_SECTION) {
        wrong.push(`${entry.slug}: ${pages} pages`);
      }
    }

    expect(
      wrong.sort(),
      'A section of more than five pages puts the demonstration on a page of ' +
        'its own. Below that the role may sit on getting-started, because a ' +
        'separate page splits a concept from its own practice.',
    ).toEqual([]);
  });
});
