import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';

import { entriesOf, exportsOf, packages } from './released-exports.js';

/**
 * Every name a package publishes is documented, and every callable one is
 * documented by an example that runs.
 *
 * `doc-exports.test.ts` checks the other direction: a fence naming a symbol is
 * held to the package's export list, so a rename cannot leave an example
 * pointing at nothing. Neither it nor anything else here notices the reverse.
 * `diffMatrix` shipped exported, built and tested, with no entry on any page,
 * and every target passed.
 *
 * Two rules, because documentation and demonstration are worth different
 * amounts per kind of export.
 *
 * Documented is every export, a type included. The bar is one `##` heading
 * spelling the name, which is what § 8 of
 * `docs/specs/2026-09-25-documentation-standard.md` already fixes an API
 * reference's headings as, so a reader searching for the
 * name lands on an anchor.
 *
 * Exercised is every export a caller can call or construct, which the type
 * checker answers through its call and construct signatures rather than a
 * syntactic guess, so a `const` holding an arrow function counts the way a
 * `function` does. A type is exempt: `FieldReason` is a union of six strings
 * and a fence that named it would be naming it to satisfy this file. A plain
 * value is exempt on the same reading, so `CRUD_ACTIONS` and
 * `CORRELATION_ID_HEADER` need the heading and nothing more.
 *
 * An executable fence is a `twoslash` fence, compiled by Nextra, or a `file=`
 * fence, whose region the loader fills from a source the package's own tests
 * run. Those two are the fences the repository already guarantees; a plain
 * ```ts fence is text, and a symbol named only there is a symbol nothing
 * checks.
 *
 * The allowance is the ratchet, on the mechanism `doc-floor.test.ts` uses. The
 * gap this file opens on is real and predates it, so it is recorded per package
 * rather than fixed here, and the second test refuses an entry that is no
 * longer needed. An export added from here on has nowhere to hide: the
 * allowance is data in a reviewed diff, and adding a name to it is a sentence
 * somebody has to write in a pull request.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLOWANCE = join(HERE, 'doc-export-coverage-allowance.json');
const CONTENT = join(workspaceRoot, 'apps/docs/content');

const FENCE = /^(\s*)(`{3,})(.*)$/;
const HEADING = /^##\s+`([^`]+)`/gm;

/** A debt: the name should be documented and is not, yet. */
interface Allowance {
  readonly undocumented?: readonly string[];
  readonly unexercised?: readonly string[];
  readonly unexplained?: readonly string[];
}

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  Allowance
>;

/** The shortest reason that can say anything, in characters. */
const REASON_FLOOR = 30;

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** Whether a fence's info string marks a block the repository compiles. */
function executable(info: string): boolean {
  return /(^|\s)twoslash(\s|$)/.test(info) || /(^|\s)file=/.test(info);
}

/** One fenced block: the info string it opened with, and its lines. */
interface Block {
  info: string;
  body: string[];
}

/** Every fenced block in a document, in order. */
function blocksOf(source: string): Block[] {
  const blocks: Block[] = [];
  let open: Block | null = null;

  for (const line of source.split('\n')) {
    const marker = line.match(FENCE);
    if (marker && open === null) {
      open = { info: (marker[3] as string).trim(), body: [] };
      continue;
    }
    if (marker && open !== null) {
      blocks.push(open);
      open = null;
      continue;
    }
    open?.body.push(line);
  }

  return blocks;
}

/**
 * The text of every executable fence on the site, by section slug, with the
 * `file=` regions already filled in.
 *
 * Executability is read off the page as written and the body off the page as
 * expanded, because the two questions have different sources. The region
 * loader replaces `ts file=… region=…` with a plain `ts`, so a fence whose
 * whole point is that a package's own tests run it looks, after expansion,
 * exactly like a fence nothing checks. Reading both and pairing by position is
 * what keeps a `file=` fence counted; expansion fills bodies and neither adds
 * a fence nor removes one, so the two lists line up.
 */
function executableCode(): Map<string, string> {
  const bySlug = new Map<string, string[]>();

  for (const page of mdxFiles(CONTENT)) {
    const slug = relative(CONTENT, page).split(sep)[0] as string;
    const raw = readFileSync(page, 'utf8');
    const written = blocksOf(raw);
    const expanded = blocksOf(
      expandRegions(raw, workspaceRoot, page) as string,
    );

    if (written.length !== expanded.length) {
      throw new Error(
        `${relative(workspaceRoot, page)}: expanding regions changed the ` +
          `fence count from ${written.length} to ${expanded.length}, so a ` +
          `fence cannot be matched to the info string it was written with`,
      );
    }

    const body = written.flatMap((block, at) =>
      executable(block.info) ? (expanded[at] as Block).body : [],
    );

    bySlug.set(slug, [...(bySlug.get(slug) ?? []), ...body]);
  }

  return new Map([...bySlug].map(([slug, lines]) => [slug, lines.join('\n')]));
}

/** The symbols an API reference page gives a heading, by section slug. */
function documented(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();

  for (const page of mdxFiles(CONTENT)) {
    const slug = relative(CONTENT, page).split(sep)[0] as string;
    const text = readFileSync(page, 'utf8');
    const names = found.get(slug) ?? new Set<string>();
    for (const [, heading] of text.matchAll(HEADING)) {
      // `provider(component, props)` and `Policy<Schema>` both name a symbol.
      names.add((heading as string).split(/[(<\s]/)[0] as string);
    }
    found.set(slug, names);
  }

  return found;
}

const sorted = (lines: readonly string[]): string[] => [...lines].sort();

/** Whether an identifier appears in a body of code, as a whole word. */
function names(code: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol.replace(/\$/g, '\\$')}\\b`).test(code);
}

interface Gap {
  /** Every name the package publishes, across all of its entry points. */
  exported: string[];
  undocumented: string[];
  unexercised: string[];
  /** Names the library publishes with no docblock of their own. */
  unexplained: string[];
  /** The names whose docblock opts them out, with the prose beside the tag. */
  internal: { name: string; reason: string }[];
}

/** What each package is short of today, before the allowance is applied. */
let memo: Promise<Map<string, Gap>> | null = null;

/**
 * Memoized, because each call builds one TypeScript program over every entry
 * point in the workspace and five assertions read the same answer.
 */
function gaps(): Promise<Map<string, Gap>> {
  memo ??= computeGaps();
  return memo;
}

async function computeGaps(): Promise<Map<string, Gap>> {
  const entries = (await packages()).flatMap(entriesOf);
  const exported = exportsOf(entries);
  const headings = documented();
  const code = executableCode();
  const found = new Map<string, Gap>();

  for (const entry of entries) {
    const gap = found.get(entry.package) ?? {
      exported: [],
      undocumented: [],
      unexercised: [],
      unexplained: [],
      internal: [],
    };
    const known = headings.get(entry.slug) ?? new Set<string>();
    const body = code.get(entry.slug) ?? '';

    for (const each of exported.get(entry.specifier) ?? []) {
      if (each.name === 'default') continue;
      gap.exported.push(each.name);

      // `@internal` is the author saying this name is published for a caller's
      // convenience and is not public API. It opts the name out of both rules,
      // because a name with no entry on a page has nowhere to put an example.
      if (each.internal) {
        gap.internal.push({ name: each.name, reason: each.reason });
        continue;
      }

      if (!known.has(each.name)) gap.undocumented.push(each.name);
      if (each.callable && !names(body, each.name)) {
        gap.unexercised.push(each.name);
      }
      if (!each.explained) gap.unexplained.push(each.name);
    }

    found.set(entry.package, gap);
  }

  return found;
}

describe('every published name is documented', () => {
  it('finds the packages and their exports', async () => {
    const found = await gaps();

    expect(found.size).toBeGreaterThan(0);
    expect([...found.keys()]).toContain('@evanion/acl');
  });

  it('gives every export a heading on its API reference', async () => {
    const failures: string[] = [];

    for (const [name, gap] of await gaps()) {
      const allowed = new Set(allowance[name]?.undocumented ?? []);
      for (const symbol of gap.undocumented) {
        if (allowed.has(symbol)) continue;
        failures.push(
          `${name} exports \`${symbol}\`, which no \`##\` heading on its API ` +
            `reference names. Add the entry. If the name is published for a ` +
            `caller's convenience and is not public API, mark it \`@internal\` ` +
            `and say why in the same docblock; if the entry is simply not ` +
            `written yet, record it in doc-export-coverage-allowance.json.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  it('exercises every callable export in a fence that runs', async () => {
    const failures: string[] = [];

    for (const [name, gap] of await gaps()) {
      const allowed = new Set(allowance[name]?.unexercised ?? []);
      for (const symbol of gap.unexercised) {
        if (allowed.has(symbol)) continue;
        failures.push(
          `${name} exports \`${symbol}\`, which no \`twoslash\` or \`file=\` ` +
            `fence calls. A reader gets a signature and no example. Add one. ` +
            `If the name is not public API, mark it \`@internal\` and say why ` +
            `in the same docblock; if the example is simply not written yet, ` +
            `record it in doc-export-coverage-allowance.json.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * The ratchet. An allowance entry is a debt somebody recorded, and a debt
   * that has been paid has to leave the file, or the allowance stops describing
   * the repository and starts hiding a regression that reintroduces the gap.
   */
  it('carries no allowance entry that is no longer needed', async () => {
    const found = await gaps();
    const failures: string[] = [];

    for (const [name, entry] of Object.entries(allowance)) {
      const gap = found.get(name);
      if (!gap) {
        failures.push(
          `doc-export-coverage-allowance.json names ${name}, which is not a ` +
            `released package. Remove the entry.`,
        );
        continue;
      }

      for (const symbol of entry.undocumented ?? []) {
        if (!gap.undocumented.includes(symbol)) {
          failures.push(
            `${name} now documents \`${symbol}\`. Remove it from the ` +
              `"undocumented" list in doc-export-coverage-allowance.json.`,
          );
        }
      }
      for (const symbol of entry.unexercised ?? []) {
        if (!gap.unexercised.includes(symbol)) {
          failures.push(
            `${name} now exercises \`${symbol}\`. Remove it from the ` +
              `"unexercised" list in doc-export-coverage-allowance.json.`,
          );
        }
      }
      for (const symbol of entry.unexplained ?? []) {
        if (!gap.unexplained.includes(symbol)) {
          failures.push(
            `${name} now documents \`${symbol}\` in source. Remove it from ` +
              `the "unexplained" list in doc-export-coverage-allowance.json.`,
          );
        }
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * A published name explains itself in the library's source.
   *
   * The generated reference renders an entry's summary from the first paragraph
   * of its docblock, so a name with none shows a signature and no prose. The
   * sentence belongs beside the declaration rather than on the page: an editor's
   * hover reads the same block, and the next build picks up an edit with no
   * documentation change at all.
   *
   * An overloaded function is the case worth knowing about. Its documentation
   * has to sit on the overloads a caller resolves to, because that is what an
   * editor shows and what the reference reads; a block on the implementation
   * signature below them is read by nobody. `serialize` was documented that way
   * and its prose reached neither.
   */
  it('gives every published name a docblock', async () => {
    const failures: string[] = [];

    for (const [name, gap] of await gaps()) {
      const allowed = new Set(allowance[name]?.unexplained ?? []);
      for (const symbol of gap.unexplained) {
        if (allowed.has(symbol)) continue;
        failures.push(
          `${name} exports \`${symbol}\` with no docblock, so its reference ` +
            `entry renders a signature and no prose. Write the sentence beside ` +
            `the declaration; on an overloaded function it belongs on the ` +
            `overloads and not on the implementation. Record it in ` +
            `doc-export-coverage-allowance.json under "unexplained" if it is ` +
            `genuinely not worth one.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * `@internal` is the opt-out, and the control on it is that the author has to
   * say why in the docblock the tag sits in. A bare `@internal` over a bare
   * name is a silent removal from the public surface, and the next person
   * reading it cannot tell whether the name is a convenience export or an
   * oversight.
   *
   * The reason lives beside the export rather than in a file here, so a rename
   * carries it, a deletion takes it, and the person deciding is looking at the
   * code when they decide.
   */
  it('makes every `@internal` export say why it is one', async () => {
    const failures: string[] = [];

    for (const [name, gap] of await gaps()) {
      for (const { name: symbol, reason } of gap.internal) {
        if (reason.trim().length < REASON_FLOOR) {
          failures.push(
            `${name} marks \`${symbol}\` \`@internal\` with no prose in the ` +
              `docblock. Say why the name is published and is not public API, ` +
              `in at least ${REASON_FLOOR} characters, beside the tag.`,
          );
        }
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * A name cannot be both opted out and owed. The allowance is a promise to
   * write something and `@internal` is a decision not to, so a name in both
   * places is one whose status nobody settled.
   */
  it('keeps an `@internal` name out of the allowance', async () => {
    const found = await gaps();
    const failures: string[] = [];

    for (const [name, entry] of Object.entries(allowance)) {
      const internal = new Set(
        (found.get(name)?.internal ?? []).map((each) => each.name),
      );
      const recorded = [
        ...(entry.undocumented ?? []),
        ...(entry.unexercised ?? []),
      ];
      for (const symbol of recorded) {
        if (internal.has(symbol)) {
          failures.push(
            `${name} marks \`${symbol}\` \`@internal\` and also records it in ` +
              `doc-export-coverage-allowance.json. Remove the allowance entry.`,
          );
        }
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  it('records no allowance for a package that has none', () => {
    expect(
      Object.entries(allowance)
        .filter(
          ([, entry]) =>
            (entry.undocumented ?? []).length === 0 &&
            (entry.unexercised ?? []).length === 0,
        )
        .map(([name]) => name),
    ).toEqual([]);
  });

  it('keeps the allowance file sorted, so a diff reads as one line', () => {
    const keys = Object.keys(allowance);
    expect(keys).toEqual(sorted(keys));

    for (const [name, entry] of Object.entries(allowance)) {
      expect(
        entry.undocumented ?? [],
        `${name} "undocumented" is out of order`,
      ).toEqual(sorted(entry.undocumented ?? []));
      expect(
        entry.unexercised ?? [],
        `${name} "unexercised" is out of order`,
      ).toEqual(sorted(entry.unexercised ?? []));
    }
  });
});
