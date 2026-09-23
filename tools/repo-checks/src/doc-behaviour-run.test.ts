import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * Every sentence a reference entry would carry, held against a run.
 *
 * The behaviour data is read from the test sources, so a reference page builds
 * without running a test and editing one test does not put a page behind a
 * twenty-second sweep. The cost of reading sources is that a page could publish
 * a sentence no runner ever reaches: a case behind a modifier the parser did not
 * know about, a file the package's own `include` pattern leaves out, or a chain
 * the parser assembled in the wrong order.
 *
 * So the same claim exists in three places -- the test source, the generated
 * JSON and the built page -- and this holds the first two together, which is the
 * shape `security-register.test.ts` uses to hold a register entry, its suite and
 * its published page together on one identifier.
 *
 * The report each library's own `test` target writes is what this reads. This
 * file used to run the libraries itself, through `nx run-many` in a
 * `beforeAll`. A task that shells back into Nx races the outer run and fails it
 * with `Recursive task invocation detected`, which is the failure
 * `task-invokes-nx.test.ts` exists to prevent, and that guard reads a
 * configured target's command and never a test source. So the dependency is
 * declared on `@evanion/repo-checks:test` instead, and Nx orders the eleven
 * library suites ahead of this one and caches each of them on its own.
 *
 * `report.json` is the same file `docs:testing-data` reads, and reading it
 * couples nothing: it is the library's own output, written by the library's own
 * target, and the `/testing` section happens to read it too.
 */

/** Where `docs:behaviour-data` writes what each library's tests state. */
const DATA = join(workspaceRoot, 'apps/docs/components/api/behaviour');

/** One chain a page would render, as the data carries it. */
interface Stated {
  chain: string[];
  generated: boolean;
}

interface Behaviours {
  package: string;
  files: string[];
  states: Record<string, Stated[]>;
}

/** One library's data file, with the package directory it was written for. */
function data(): { directory: string; behaviours: Behaviours }[] {
  let files: string[];
  try {
    files = readdirSync(DATA).filter((name) => name.endsWith('.json'));
  } catch {
    throw new Error(
      `${DATA} does not exist. Run \`npx nx run docs:behaviour-data\`.`,
    );
  }

  return files.sort().map((name) => ({
    directory: basename(name, '.json'),
    behaviours: JSON.parse(
      readFileSync(join(DATA, name), 'utf8'),
    ) as Behaviours,
  }));
}

/** Every chain the data holds, each one named once however many keys carry it. */
function stated(behaviours: Behaviours): Stated[] {
  const found = new Map<string, Stated>();

  for (const held of Object.values(behaviours.states)) {
    for (const each of held) {
      found.set(`${each.generated}\u0000${each.chain.join('\u0000')}`, each);
    }
  }

  return [...found.values()];
}

/**
 * Where each library's run leaves what it reported.
 *
 * Inside the directory the `test` target declares as its output, so a cached
 * run restores the report along with everything else it wrote. A report left
 * outside it would be missing on the first cache replay and the check would
 * fail on a machine that had done nothing wrong.
 */
const REPORT = join('test-output', 'vitest', 'coverage', 'report.json');

/** What one library's suite reported, as chains. */
function chainsOf(directory: string): {
  cases: Set<string>;
  groups: Set<string>;
} {
  const path = join(workspaceRoot, 'libs', directory, REPORT);
  const report = JSON.parse(readFileSync(path, 'utf8')) as {
    testResults: {
      assertionResults: { ancestorTitles: string[]; title: string }[];
    }[];
  };

  const cases = new Set<string>();
  const groups = new Set<string>();

  for (const file of report.testResults) {
    for (const each of file.assertionResults) {
      cases.add([...each.ancestorTitles, each.title].join(' > '));
      for (let at = 1; at <= each.ancestorTitles.length; at += 1) {
        groups.add(each.ancestorTitles.slice(0, at).join(' > '));
      }
    }
  }

  return { cases, groups };
}

describe('the sentences a reference entry would carry', () => {
  const libraries = data();

  it('finds a data file for every released library', () => {
    expect(libraries.length).toBeGreaterThan(0);
    expect(libraries.map((each) => each.behaviours.package)).toContain(
      '@evanion/acl',
    );
  });

  it.each(libraries)(
    'states nothing $behaviours.package did not run',
    ({ directory, behaviours }) => {
      const reported = chainsOf(directory);
      const failures: string[] = [];

      for (const each of stated(behaviours)) {
        const chain = each.chain.join(' > ');
        const found = each.generated
          ? reported.groups.has(chain)
          : reported.cases.has(chain);
        if (!found) {
          failures.push(
            `${behaviours.package} would render "${chain}" on a reference ` +
              `entry, and no case of that name ran. The sentence is read from ` +
              `the test source, so either the case does not run or ` +
              `behaviours.mjs read it wrong.`,
          );
        }
      }

      expect(failures.sort()).toEqual([]);
    },
    300_000,
  );
});
