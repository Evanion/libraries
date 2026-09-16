import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G4 of `docs/specs/2026-09-16-documentation-standard.md` § 12: every section
 * has a control.
 *
 * The page named by `demo` in `apps/docs/app/navigation.ts` mounts one of the
 * site's controls, unless that entry carries a `demoExempt` reason. § 5 names
 * the cases where a control is not achievable — a running server, a compile
 * step with no browser runtime, a trust boundary — and a section granted one
 * says so on the page as well, which a guard cannot read.
 *
 * What this reaches is that a control is mounted. Whether the prose around it
 * teaches, and whether the control teaches or is a toy, are readings § 12 lists
 * as resting on a reviewer. It is a per-section floor and it is blind to § 7's
 * per-page rule that a page introducing a concept carries a control of its own.
 *
 * `doc-control-allowance.json` is the ratchet, on the same mechanism as
 * `doc-prose-budget.json`. An allowance is a control that is coming, with the
 * step it comes in; a `demoExempt` is a control that is not coming. Keeping the
 * two apart is the point of having both: an allowance is removed when the
 * component lands, and an exemption is argued once and stays.
 */

const DOCS = join(workspaceRoot, 'apps/docs');
const CONTENT = join(DOCS, 'content');
const MAP = join(DOCS, 'mdx-components.js');
const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'doc-control-allowance.json',
);

/** The `navigation.ts` shape this guard reads, restated rather than imported. */
interface DocumentedPackage {
  slug: string;
  documented: boolean;
  demo?: string;
  demoExempt?: string;
}

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  string
>;

/**
 * The controls a demonstration page may mount.
 *
 * The three general ones are named, and the landing specimens are read out of
 * `mdx-components.js` rather than listed, because decision 20 is what puts a
 * specimen on the map in the first place: a component under
 * `components/landing/` that is not registered there cannot be mounted on a
 * page at all, so the map is the set.
 */
function controls(): string[] {
  const source = readFileSync(MAP, 'utf8');
  const specimens = [
    ...source.matchAll(/^import\s+(\w+)\s+from\s+'\.\/components\/landing\//gm),
  ].map(([, name]) => name as string);

  return ['Probe', 'WidgetPlayground', 'PlaygroundExamples', ...specimens];
}

async function documentedSections(): Promise<DocumentedPackage[]> {
  const module_ = (await import(
    pathToFileURL(join(DOCS, 'app', 'navigation.ts')).href
  )) as { packages: readonly DocumentedPackage[] };

  return module_.packages.filter((entry) => entry.documented);
}

/** Whether the page mounts one of the controls, as a JSX tag. */
function mountsControl(slug: string, page: string, names: string[]): boolean {
  const path = ['.mdx', '.md']
    .map((extension) => join(CONTENT, slug, `${page}${extension}`))
    .find((candidate) => existsSync(candidate));

  if (path === undefined) return false;

  const source = readFileSync(path, 'utf8');

  return names.some((name) => new RegExp(`<${name}[\\s/>]`).test(source));
}

describe('the section control', () => {
  it('finds the controls the site registers', () => {
    expect(controls().length).toBeGreaterThan(0);
  });

  it('is mounted on the page every section names as its demonstration', async () => {
    const names = controls();
    const bare: string[] = [];

    for (const entry of await documentedSections()) {
      if (entry.demoExempt !== undefined) continue;
      if (entry.slug in allowance) continue;
      if (entry.demo === undefined) continue;

      if (!mountsControl(entry.slug, entry.demo, names)) {
        bare.push(`${entry.slug}: ${entry.demo}`);
      }
    }

    expect(
      bare.sort(),
      `Each of these sections names a demonstration page that mounts none of ` +
        `${names.join(', ')}. Mount one, record a \`demoExempt\` reason in ` +
        `apps/docs/app/navigation.ts, or record the wait in ` +
        `doc-control-allowance.json.`,
    ).toEqual([]);
  });

  it('records no wait a section has already ended', async () => {
    const names = controls();
    const stale: string[] = [];

    for (const entry of await documentedSections()) {
      if (!(entry.slug in allowance)) continue;
      if (entry.demo === undefined) continue;

      if (mountsControl(entry.slug, entry.demo, names)) {
        stale.push(entry.slug);
      }
    }

    expect(
      stale.sort(),
      'These are recorded in doc-control-allowance.json and the control is ' +
        'now mounted. Remove the entry.',
    ).toEqual([]);
  });

  it('gives a reason with every exemption', async () => {
    const empty = (await documentedSections())
      .filter((entry) => entry.demoExempt?.trim() === '')
      .map((entry) => entry.slug);

    expect(
      empty,
      'A `demoExempt` is the reason a section has nothing to click, written ' +
        'for the reviewer who asks why. An empty one records nothing.',
    ).toEqual([]);
  });

  it('exempts no section that also records a wait', async () => {
    const both = (await documentedSections())
      .filter((entry) => entry.demoExempt !== undefined)
      .filter((entry) => entry.slug in allowance)
      .map((entry) => entry.slug);

    expect(
      both,
      'A `demoExempt` says the control is not coming and an allowance says it ' +
        'is. Drop one.',
    ).toEqual([]);
  });
});
