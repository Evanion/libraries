import { join, relative, sep } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { describedBy, testFilesOf } from '@evanion/doc-examples/behaviours';

import {
  entriesOf,
  exportsOf,
  packages,
  type DocumentedPackage,
} from './released-exports.js';

/**
 * G11 -- every non-error callable export has a `describe` naming it.
 *
 * The API reference lists, under each export, the sentences its own tests carry.
 * Attribution is stated rather than inferred: a case belongs to an export when
 * some `describe` in its chain spells that export's name exactly. A reference
 * walk would attach a case to every name it mentions, and coverage would attach
 * `ruleId` to the 19 acl test files that execute a rule identifier while naming
 * it in 3. Only the `describe` says what the author meant the case to be about.
 *
 * Exactly, and at any depth. `describe('hydratePolicy')` owns, `describe('the
 * hydratePolicy seam')` owns nothing, and
 * `hydratePolicy > canFields decides a proposed key the object does not carry`
 * owns at depth two, which is where the conditional material lives.
 *
 * An error class is exempt. What a reader wants to know about
 * `InvalidConditionError` is which call throws it and when, and that sentence
 * belongs under the function that throws. 38 of the 95 callable exports across
 * the libraries are error classes, 26 of them in `@evanion/acl`.
 *
 * `libs/acl/src/security` is exempt. Its `describe` titles are register
 * identifiers, `SEC-007 a narrowed write never carries a prototype setter
 * (CWE-1321)`, and `security-register.test.ts` holds the register, the suite and
 * the published page together on that identifier while `SECURITY.md`'s tier
 * decides what a test there may claim. A `describe` renamed to an export name
 * loses all three, and the register's claim is made by a person.
 *
 * This fails rather than reports. The spec that specified it as reporting
 * assumed one package would adopt the convention and ten would carry the debt in
 * an allowance; every library adopts, so the debt is zero and an allowance would
 * be an empty file whose only function is to let the next export skip the rule.
 *
 * The chains come from `@evanion/doc-examples/behaviours`, which is the reader
 * the reference pages render from. One walk over the test sources answers both
 * questions, so the rule and the page cannot disagree about which names a
 * package's `describe` blocks spell.
 *
 * What it does not ask. It never asks that every `describe` name an export: a
 * README doctest's heading, `the package entry`, and
 * `a builder-authored policy published as a contract` each belong to no single
 * export and should not pretend to. It never asks that a type have one. It does
 * not read `it` titles at all.
 */

/**
 * Names the rule reports and the repository accepts, each with its reason.
 *
 * Kept inline rather than in an allowance file, on
 * `exported-type-closure.test.ts`'s reading: a ratchet is for a debt somebody
 * intends to pay, and a name here is a decision that the convention does not
 * apply. A reason a reader meets beside the rule is likelier to be argued with
 * than one in a JSON list.
 *
 * One name. Every other non-error callable export of every released package
 * carries a `describe` naming it.
 */
const ACCEPTED: Readonly<Record<string, string>> = {
  '@evanion/widget: resetWarnings':
    'Clears the set of already-reported messages, for the adapters, whose ' +
    'test-setup calls it before every case. Its effect is that the next case ' +
    'sees the warning `warnOnce` would otherwise swallow, which is a ' +
    'precondition of the cases under `warnOnce` and not a behaviour a case ' +
    'of its own can state without asserting on the helper that set it up.',
};

/** Where a package's tests live, as the shared reader wants it. */
const rootOf = (item: DocumentedPackage): string =>
  join(workspaceRoot, item.root);

/** What a package's tests state a behaviour under, and what they do not. */
interface Subject {
  /** Callable exports that are not error classes. */
  subjects: string[];
  /** Those of them the declaring package's tests name in no `describe`. */
  unstated: { name: string; declaredBy: string }[];
}

/**
 * The package a name is declared in, which is the package whose tests state its
 * behaviour.
 *
 * `@evanion/react-widget` and `@evanion/astro-widget` publish `defineWidgets`
 * and `validateItems` so that a consumer who never names the core never
 * installs it by hand, and the function they publish is `@evanion/widget`'s,
 * where `describe('validateItems')` already stands. Asking each re-exporter for
 * a `describe` of its own would ask three suites to state one function's
 * behaviour, and two of them would be stating it about code they do not own.
 */
function declarer(
  declaredIn: string | null,
  roots: readonly (readonly [string, string])[],
  fallback: string,
): string {
  if (declaredIn === null) return fallback;
  const owner = roots.find(([root]) => declaredIn.startsWith(root));
  return owner?.[1] ?? fallback;
}

async function subjects(): Promise<Map<string, Subject>> {
  const found = new Map<string, Subject>();
  const documented = await packages();
  const exported = exportsOf(documented.flatMap(entriesOf));
  const roots = documented.map(
    (item) => [`${join(workspaceRoot, item.root)}${sep}`, item.name] as const,
  );
  const titles = new Map(
    documented.map((item) => [item.name, describedBy(rootOf(item))] as const),
  );

  for (const item of documented) {
    const subject: Subject = { subjects: [], unstated: [] };

    for (const entry of entriesOf(item)) {
      for (const each of exported.get(entry.specifier) ?? []) {
        if (each.name === 'default') continue;
        if (!each.callable) continue;
        if (each.name.endsWith('Error')) continue;
        if (subject.subjects.includes(each.name)) continue;

        subject.subjects.push(each.name);
        const declaredBy = declarer(each.declaredIn, roots, item.name);
        if (!titles.get(declaredBy)?.has(each.name)) {
          subject.unstated.push({ name: each.name, declaredBy });
        }
      }
    }

    found.set(item.name, subject);
  }

  return found;
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('what the tests state', () => {
  it('finds the packages and their callable exports', async () => {
    const found = await subjects();

    expect(found.size).toBeGreaterThan(0);
    expect(found.get('@evanion/acl')?.subjects).toContain('hydratePolicy');
  });

  it('gives every non-error callable export a `describe` naming it', async () => {
    const failures: string[] = [];

    for (const [name, subject] of await subjects()) {
      for (const { name: symbol, declaredBy } of subject.unstated) {
        if (`${declaredBy}: ${symbol}` in ACCEPTED) continue;
        failures.push(
          `${name} exports \`${symbol}\`, which no \`describe\` in ` +
            `${declaredBy}'s tests names exactly, so its reference entry ` +
            `lists no behaviour. Wrap the cases that are about it in ` +
            `\`describe('${symbol}', …)\`, at any depth. Renaming an existing ` +
            `\`describe\` is enough; no assertion moves.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * The exemption list is for a name the convention cannot apply to, so an entry
   * naming a package that no longer publishes it, or one whose tests now state
   * it, is a rule somebody stopped needing and nobody removed.
   */
  it('accepts no name that is stated after all', async () => {
    const found = await subjects();
    const failures: string[] = [];

    for (const key of Object.keys(ACCEPTED)) {
      const [name, symbol] = key.split(': ');
      const subject = name === undefined ? undefined : found.get(name);
      if (!subject || symbol === undefined) {
        failures.push(
          `doc-behaviour.test.ts accepts "${key}", which names no released ` +
            `package. Remove the entry.`,
        );
        continue;
      }
      if (!subject.unstated.some((each) => each.name === symbol)) {
        failures.push(
          `${name} now states a behaviour under \`${symbol}\`. Remove the ` +
            `entry from ACCEPTED in doc-behaviour.test.ts.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * The adversarial suite is read by `security-register.test.ts` and not by
   * this file. A `describe` there spelling an export name would satisfy G11
   * from a suite whose titles are register identifiers, so the skip has to be
   * a skip and not a filter that a nested title can slip through.
   */
  it('reads no title from the adversarial suite', async () => {
    const acl = (await packages()).find((item) => item.name === '@evanion/acl');
    expect(acl).toBeDefined();

    const files = testFilesOf(rootOf(acl as DocumentedPackage)).map((path) =>
      relative(workspaceRoot, path),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(
      files.filter((path) => path.split(sep).includes('security')),
    ).toEqual([]);
  });
});
