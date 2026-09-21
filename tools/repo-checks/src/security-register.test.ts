import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * The security register is held to the suite that proves it, and to the page
 * that publishes it.
 *
 * `libs/acl/SECURITY.md` opens by claiming this check exists: "The adversarial
 * suite in `src/security` is checked against this file: one entry per class,
 * one identifier, and the test that proves the entry." Nothing checked it. The
 * three agreed by hand, which is the state a register is least able to stay in,
 * because an entry is added under the impression that something is watching.
 *
 * A register nobody checks is worse than no register. It is read as evidence,
 * and evidence that drifts silently makes a stronger claim than the code
 * supports: an entry whose test was renamed still reads as a defence that runs.
 *
 * Four things hold, and each one is a way the three copies come apart:
 *
 * - Every identifier in the register names a test, and every identifier in a
 *   test is in the register. A defence with no test is a claim, and a test with
 *   no entry is work nobody can find.
 * - A tier's entries live in that tier's file. The tier decides what a test may
 *   assert -- tier 3 asserts no defence -- so an entry proved in the wrong file
 *   is proved against the wrong bar.
 * - The stated counts match the rows. The register states them in prose, and a
 *   prose count is the first thing to go stale when a row is added.
 * - The published page carries the same identifiers as the register. The page
 *   is what a reader sees, and the register is what the suite is held to.
 */

const SECURITY = join(workspaceRoot, 'libs/acl/SECURITY.md');
const SUITE = join(workspaceRoot, 'libs/acl/src/security');
const PAGE = join(workspaceRoot, 'apps/docs/content/acl/register.mdx');

/** An identifier as the register and the suite both spell it. */
const ID = /SEC-\d{3}/g;

/** A register row: the identifier first, the test last. */
const ROW = /^\|\s*(SEC-\d{3})\s*\|(.*)\|\s*$/;

/** A tier heading, which opens the table its rows belong to. */
const TIER = /^## Tier (\d)\b/;

/** The prose count the register states for itself. */
const COUNTS = /^Counts:\s*(\d+) tier 1,\s*(\d+) tier 2,\s*(\d+) tier 3\.?$/m;

interface Entry {
  id: string;
  tier: number;
  /** The test file the last column names, without backticks. */
  file: string;
}

function registerEntries(): Entry[] {
  const entries: Entry[] = [];
  let tier = 0;

  for (const line of readFileSync(SECURITY, 'utf8').split('\n')) {
    const heading = line.match(TIER);
    if (heading) {
      tier = Number(heading[1]);
      continue;
    }

    const row = line.match(ROW);
    if (!row) continue;

    // The last cell names the test, as `tier1-prevented.test.ts` › SEC-001.
    const cells = (row[2] as string).split('|');
    const last = (cells[cells.length - 1] ?? '').trim();
    entries.push({
      id: row[1] as string,
      tier,
      file: last.match(/`([^`]+)`/)?.[1] ?? '',
    });
  }

  return entries;
}

/** Every identifier a suite file names, by file. */
function suiteIds(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();

  for (const name of readdirSync(SUITE)) {
    if (!name.endsWith('.test.ts')) continue;
    const text = readFileSync(join(SUITE, name), 'utf8');
    found.set(name, new Set(text.match(ID) ?? []));
  }

  return found;
}

const sorted = (values: Iterable<string>): string[] => [...values].sort();

describe('the acl security register', () => {
  const entries = registerEntries();
  const suite = suiteIds();

  it('finds the register and the suite', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(suite.size).toBeGreaterThan(0);
  });

  it('gives every identifier exactly one entry', () => {
    const ids = entries.map((entry) => entry.id);
    expect(sorted(ids)).toEqual(sorted(new Set(ids)));
  });

  it('proves every entry with a test that names it', () => {
    const proven = new Set([...suite.values()].flatMap((ids) => [...ids]));
    const unproven = entries
      .filter((entry) => !proven.has(entry.id))
      .map((entry) => entry.id);

    expect(
      sorted(unproven),
      'entries in SECURITY.md that no test names',
    ).toEqual([]);
  });

  it('gives every test identifier an entry', () => {
    const known = new Set(entries.map((entry) => entry.id));
    const orphans: string[] = [];

    for (const [file, ids] of suite) {
      for (const id of ids) {
        if (!known.has(id)) orphans.push(`${file}: ${id}`);
      }
    }

    expect(
      sorted(orphans),
      'identifiers a test names that SECURITY.md does not carry',
    ).toEqual([]);
  });

  /**
   * The tier is the bar the test is held to, so an entry proved in another
   * tier's file is proved against the wrong one. A tier 3 entry asserts that no
   * defence exists, and the same identifier passing in `tier1-prevented` would
   * read as the opposite.
   */
  it('proves each entry in the file its tier owns', () => {
    const wrong: string[] = [];

    for (const entry of entries) {
      const ids = suite.get(entry.file);
      if (!ids) {
        wrong.push(
          `${entry.id}: names \`${entry.file}\`, which is not a file in ` +
            `libs/acl/src/security`,
        );
        continue;
      }
      if (!ids.has(entry.id)) {
        wrong.push(`${entry.id}: \`${entry.file}\` does not name it`);
      }
      if (!entry.file.startsWith(`tier${entry.tier}`)) {
        wrong.push(
          `${entry.id}: sits under Tier ${entry.tier} and names ` +
            `\`${entry.file}\`, so the entry is proved against another ` +
            `tier's bar`,
        );
      }
    }

    expect(sorted(wrong)).toEqual([]);
  });

  it('states counts that match its rows', () => {
    const stated = readFileSync(SECURITY, 'utf8').match(COUNTS);
    expect(stated, 'SECURITY.md states no "Counts:" line').not.toBeNull();

    const actual = [1, 2, 3].map(
      (tier) => entries.filter((entry) => entry.tier === tier).length,
    );
    const claimed = [1, 2, 3].map((at) =>
      Number((stated as RegExpMatchArray)[at]),
    );

    expect(claimed, 'the stated counts against the rows').toEqual(actual);
  });

  /**
   * The page is the register a reader meets. It carries its own wording, so
   * only the identifiers are compared: a row missing from the page is a class
   * the package is held against and does not publish, and a row only on the
   * page is a defence claimed to a reader and proved nowhere.
   */
  it('publishes the same identifiers on the register page', () => {
    const published = new Set(readFileSync(PAGE, 'utf8').match(ID) ?? []);
    const known = new Set(entries.map((entry) => entry.id));

    expect(
      sorted([...known].filter((id) => !published.has(id))),
      'entries in SECURITY.md that the register page does not publish',
    ).toEqual([]);
    expect(
      sorted([...published].filter((id) => !known.has(id))),
      'identifiers the register page publishes that SECURITY.md does not carry',
    ).toEqual([]);
  });
});
