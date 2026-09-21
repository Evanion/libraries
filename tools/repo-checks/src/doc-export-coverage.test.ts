import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';

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
 * spelling the name, which is what decision 8 of the documentation standard
 * already fixes an API reference's headings as, so a reader searching for the
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
const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');
const CONTENT = join(workspaceRoot, 'apps/docs/content');

const FENCE = /^(\s*)(`{3,})(.*)$/;
const HEADING = /^##\s+`([^`]+)`/gm;

/** A debt: the name should be documented and is not, yet. */
interface Allowance {
  readonly undocumented?: readonly string[];
  readonly unexercised?: readonly string[];
}

const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  Allowance
>;

/** The shortest reason that can say anything, in characters. */
const REASON_FLOOR = 30;

/** What `apps/docs/app/navigation.ts` exports, restated rather than imported. */
interface DocumentedPackage {
  name: string;
  root: string;
  slug: string;
}

async function packages(): Promise<readonly DocumentedPackage[]> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };
  return module_.packages;
}

/** One published entry point, with the TypeScript source behind it. */
interface Entry {
  package: string;
  slug: string;
  specifier: string;
  source: string;
}

/**
 * Every entry point a package publishes that resolves to TypeScript.
 *
 * `@evanion/source` is the condition each package maps to its own `src/`. A
 * pattern carrying a `*` is skipped: `@evanion/astro-widget` publishes
 * `./components/*` as `.astro` files, which carry no export list to hold
 * anything to, and a wildcard names no fixed set of entry points to walk.
 */
function entriesOf(item: DocumentedPackage): Entry[] {
  const manifest = JSON.parse(
    readFileSync(join(workspaceRoot, item.root, 'package.json'), 'utf8'),
  ) as { exports?: Record<string, unknown> };
  const found: Entry[] = [];

  for (const [pattern, target] of Object.entries(manifest.exports ?? {})) {
    if (pattern.includes('*')) continue;
    const source =
      typeof target === 'string'
        ? target
        : ((target as Record<string, string> | null)?.['@evanion/source'] ??
          null);
    if (source === null || !/\.tsx?$/.test(source)) continue;

    found.push({
      package: item.name,
      slug: item.slug,
      specifier:
        pattern === '.' ? item.name : `${item.name}${pattern.slice(1)}`,
      source: join(workspaceRoot, item.root, source),
    });
  }

  return found;
}

/** One exported name, with what its own docblock says about it. */
interface Exported {
  name: string;
  /** Whether a caller can call or construct it. */
  callable: boolean;
  /** Whether its docblock carries `@internal`. */
  internal: boolean;
  /** Its docblock's prose, which is where an `@internal` states its reason. */
  reason: string;
}

/**
 * Every name an entry point exports, with the callables marked.
 *
 * One program over every entry at once, with `@evanion/*` mapped to source, so
 * a name one package re-exports from another resolves rather than arriving as
 * an unresolved alias whose kind cannot be read.
 */
function exportsOf(entries: readonly Entry[]): Map<string, Exported[]> {
  const paths: Record<string, string[]> = {};
  for (const entry of entries) {
    if (entry.specifier === entry.package) paths[entry.package] = [entry.source];
  }

  const program = ts.createProgram(
    entries.map((entry) => entry.source),
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      paths,
    },
  );
  const checker = program.getTypeChecker();
  const found = new Map<string, Exported[]>();

  for (const entry of entries) {
    const source = program.getSourceFile(entry.source);
    if (!source) throw new Error(`${entry.source} is not in the program`);

    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) throw new Error(`${entry.specifier} exports nothing`);

    found.set(
      entry.specifier,
      checker.getExportsOfModule(symbol).map((each) => {
        const resolved =
          each.getFlags() & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(each)
            : each;
        const type = checker.getTypeOfSymbolAtLocation(resolved, source);
        const callable =
          Boolean(resolved.getFlags() & ts.SymbolFlags.Value) &&
          (type.getCallSignatures().length > 0 ||
            type.getConstructSignatures().length > 0);
        const marked = internalMark(each, resolved, checker);
        return {
          name: each.getName(),
          callable,
          internal: marked !== null,
          reason: marked ?? '',
        };
      }),
    );
  }

  return found;
}

/**
 * A JSDoc comment as text. It arrives as a string, or as nodes once the block
 * carries an inline tag such as a `{@link}`.
 */
function commentText(
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
): string {
  if (comment === undefined) return '';
  if (typeof comment === 'string') return comment;
  return comment.map((part) => part.text ?? '').join('');
}

/**
 * The prose of the docblock that marks a symbol `@internal`, or `null` when
 * nothing marks it.
 *
 * The tag is read off the declaration and its two enclosing nodes, because
 * where it lands depends on how the name is exported. `export const x` puts it
 * on the `VariableStatement` two levels above the declaration, and
 * `export { x } from './x.js'` puts it on the `ExportDeclaration` two levels
 * above the specifier. An author writes the tag above the line either way.
 *
 * The prose returned is the comment of the block the tag sits in, not the
 * symbol's documentation. A re-export tagged `@internal` whose target carries a
 * long docblock about what the function does has still said nothing about why
 * it is not public API, and that sentence is the one being asked for.
 */
function internalMark(
  symbol: ts.Symbol,
  resolved: ts.Symbol,
  checker: ts.TypeChecker,
): string | null {
  const nodes = [
    ...(symbol.getDeclarations() ?? []),
    ...(resolved.getDeclarations() ?? []),
  ].flatMap((node) => [node, node.parent, node.parent?.parent]);

  for (const node of nodes) {
    if (!node) continue;
    for (const tag of ts.getJSDocTags(node)) {
      if (tag.tagName.text.toLowerCase() !== 'internal') continue;
      const block = tag.parent as ts.JSDoc;
      return [commentText(block.comment), commentText(tag.comment)]
        .map((text) => text.trim())
        .filter(Boolean)
        .join(' ');
    }
  }

  // A tag the checker reports but no node carries, which happens for a symbol
  // whose declaration is in a file outside this program.
  const reported = [...symbol.getJsDocTags(checker), ...resolved.getJsDocTags(checker)]
    .find((tag) => tag.name.toLowerCase() === 'internal');
  return reported ? ts.displayPartsToString(reported.text ?? []) : null;
}

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

/**
 * The text of every executable fence on the site, by section slug, with the
 * `file=` regions already filled in.
 */
function executableCode(): Map<string, string> {
  const bySlug = new Map<string, string[]>();

  for (const page of mdxFiles(CONTENT)) {
    const slug = relative(CONTENT, page).split(sep)[0] as string;
    const source = expandRegions(
      readFileSync(page, 'utf8'),
      workspaceRoot,
      page,
    ) as string;

    let open: string | null = null;
    const body: string[] = [];

    for (const line of source.split('\n')) {
      const marker = line.match(FENCE);
      if (marker && open === null) {
        open = (marker[3] as string).trim();
        continue;
      }
      if (marker && open !== null) {
        open = null;
        continue;
      }
      if (open !== null && executable(open)) body.push(line);
    }

    bySlug.set(slug, [...(bySlug.get(slug) ?? []), ...body]);
  }

  return new Map(
    [...bySlug].map(([slug, lines]) => [slug, lines.join('\n')]),
  );
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
            `reference names. Add the entry. If the name is published for ` +
            `a caller's convenience and is never going to be documented, ` +
            `state why in doc-export-coverage-exempt.json; if it is simply ` +
            `not written yet, record it in doc-export-coverage-allowance.json.`,
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
            `If the name cannot sensibly carry one, state why in ` +
            `doc-export-coverage-exempt.json; if the example is simply not ` +
            `written yet, record it in doc-export-coverage-allowance.json.`,
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
