import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';

/**
 * G5 of `docs/specs/2026-09-16-documentation-standard.md` § 12: no fence
 * imports a name its package does not export.
 *
 * A fence naming a symbol that was renamed or never existed is the failure that
 * costs a reader the most, because the example looks right and the error the
 * reader gets is about a module rather than about the call they wanted. Nothing
 * else in this repo sees it: a `file=` fence is compiled by its own source, a
 * `twoslash` fence is compiled by Nextra, and every other fence is text.
 *
 * Three things are checked, all of them strings the fence carries and none of
 * them inside a block:
 *
 * - The named bindings of every `import … from '@evanion/…'` in any fence.
 * - The `@evanion/…` references in a `mermaid` fence, package and symbol.
 * - The symbol a `signature` fence documents, which § 12 fixes as the backticked
 *   text of the `##` heading the fence sits under.
 *
 * What a `signature` fence says inside the block is not read. A signature is
 * full of identifiers no package exports -- `string`, `Date`, `Promise`, a
 * parameter called `now` -- and separating those from a package type needs a
 * list of every TypeScript built-in, which goes stale in the direction that
 * produces false failures. § 12 names that gap and decision 21 is what closes
 * it, by emitting the block from the declarations.
 *
 * Two more things this reaches past, and both are wider than § 12 says:
 *
 * An entry point that is not TypeScript has no export list to hold anything to.
 * `@evanion/astro-widget` publishes `./components/*` as `.astro` files, so a
 * fence importing one is checked for the specifier resolving through the
 * `exports` map and for nothing else. Five imports on the site are in that
 * position today.
 *
 * The `mermaid` extension matches `@evanion/<package>` and an attached
 * `.Symbol` or `#Symbol`, which is the only spelling that names both halves.
 * § 12 does not say how a diagram spells a symbol, so a diagram naming one bare
 * -- a node labelled `hydratePolicy` -- is invisible here. The site's one
 * diagram names no symbol at all, so the extension catches nothing today and
 * will keep catching nothing until the spelling is decided.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');

const FENCE = /^(\s*)(`{3,})(.*)$/;
const IMPORT =
  /^\s*import\s+(?:type\s+)?([^;'"]*?)\s*from\s*['"](@evanion\/[^'"]+)['"]/gm;
const HEADING = /^##\s+(.*)$/;
const BACKTICKED = /`([^`]+)`/;
/** A package reference in a diagram: the specifier, then an optional symbol. */
const DIAGRAM_REFERENCE = /(@evanion\/[a-z0-9-]+)(?:[.#]([A-Za-z_$][\w$]*))?/g;

interface Fence {
  /** Workspace-relative path, with the line the fence opens on. */
  page: string;
  /** The content directory the page sits in, workspace-relative. */
  slug: string;
  info: string;
  code: string;
  /** The backticked text of the nearest `##` heading above the fence. */
  heading: string | null;
}

/** What `apps/docs/app/navigation.ts` exports, restated rather than imported.
 *
 * The same reasoning as `docs-navigation.test.ts`: importing the type across
 * the project boundary puts an app's source inside this project's compilation. */
interface DocumentedPackage {
  name: string;
  root: string;
  slug: string;
}

/**
 * The released packages, read through `navigation.ts` so that a new package is
 * covered by joining the workspace. `docs-navigation.test.ts` holds that file
 * to `nx.json`'s `release.projects` in both directions, so it is the list.
 */
async function packages(): Promise<readonly DocumentedPackage[]> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };

  return module_.packages;
}

/**
 * The source file an import specifier resolves to, or `null` for a specifier
 * the package's `exports` map does not carry.
 *
 * `@evanion/source` is the condition every package in this workspace maps to
 * its own `src/`, and it is what the docs app resolves a package through. A
 * specifier is held to the map rather than to `src/index.ts`, because the
 * packages are not all one entry: `@evanion/feature` publishes `./react`,
 * `@evanion/astro-widget` publishes `./components/*`, and `@evanion/react-acl`
 * enters at `index.tsx`.
 */
async function sourceFor(specifier: string): Promise<string | null> {
  const item = (await packages()).find(
    (it) => specifier === it.name || specifier.startsWith(`${it.name}/`),
  );
  if (!item) return null;

  const manifest = JSON.parse(
    readFileSync(join(workspaceRoot, item.root, 'package.json'), 'utf8'),
  ) as { exports?: Record<string, unknown> };
  const subpath = `.${specifier.slice(item.name.length)}`;

  for (const [pattern, target] of Object.entries(manifest.exports ?? {})) {
    const source =
      typeof target === 'string'
        ? target
        : ((target as Record<string, string> | null)?.['@evanion/source'] ??
          null);
    if (source === null) continue;

    if (pattern === subpath) return join(workspaceRoot, item.root, source);

    const star = pattern.indexOf('*');
    if (star === -1) continue;

    const before = pattern.slice(0, star);
    const after = pattern.slice(star + 1);
    if (subpath.startsWith(before) && subpath.endsWith(after)) {
      const filled = subpath.slice(
        before.length,
        subpath.length - after.length,
      );
      return join(workspaceRoot, item.root, source.replace('*', filled));
    }
  }

  return null;
}

/**
 * Every name an entry point exports, keyed by import specifier.
 *
 * One program over every entry point at once, with `@evanion/*` mapped to
 * source, so that a name a package re-exports from another package in this
 * workspace is resolved rather than lost. Resolution is `bundler`, which is
 * what rewrites the `./widget.js` an entry point imports onto the `.tsx` beside
 * it.
 *
 * An entry point that is not TypeScript -- `@evanion/astro-widget` publishes
 * `.astro` components -- carries no export list here. Its specifier is checked
 * against the `exports` map and its named bindings are not checked at all,
 * which is stated rather than covered by a rule that reads stronger.
 */
async function exportsBySpecifier(
  specifiers: readonly string[],
): Promise<Map<string, Set<string>>> {
  const paths: Record<string, string[]> = {};
  for (const item of await packages()) {
    const source = await sourceFor(item.name);
    if (source) paths[item.name] = [source];
  }

  const entries = new Map<string, string>();
  for (const specifier of new Set(specifiers)) {
    const source = await sourceFor(specifier);
    if (source && /\.tsx?$/.test(source)) entries.set(specifier, source);
  }

  const program = ts.createProgram(
    [...new Set([...Object.values(paths).flat(), ...entries.values()])],
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      paths,
    },
  );
  const checker = program.getTypeChecker();
  const found = new Map<string, Set<string>>();

  for (const [specifier, entry] of entries) {
    const source = program.getSourceFile(entry);
    if (!source) throw new Error(`${entry} is not in the program`);

    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) throw new Error(`${entry} exports nothing`);

    found.set(
      specifier,
      new Set(checker.getExportsOfModule(symbol).map((it) => it.getName())),
    );
  }

  return found;
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * Every fenced block in one document, closing on a marker of its own width,
 * carrying the `##` heading in force where it opens.
 */
function fencesIn(source: string, page: string, slug: string): Fence[] {
  const fences: Fence[] = [];
  let open: { ticks: string; info: string; at: number } | null = null;
  let heading: string | null = null;
  let body: string[] = [];

  source.split('\n').forEach((line, index) => {
    const marker = line.match(FENCE);

    if (marker && open === null) {
      open = {
        ticks: marker[2] as string,
        info: (marker[3] as string).trim(),
        at: index + 1,
      };
      body = [];
      return;
    }

    if (open === null) {
      const found = line.match(HEADING);
      if (found) heading = found[1]?.match(BACKTICKED)?.[1] ?? null;
      return;
    }

    if (marker && (marker[2] as string).startsWith(open.ticks)) {
      fences.push({
        page: `${page}:${open.at}`,
        slug,
        info: open.info,
        code: body.join('\n'),
        heading,
      });
      open = null;
      return;
    }

    body.push(line);
  });

  return fences;
}

/** Every fence on the site, with its regions already filled in. */
function fences(): Fence[] {
  return mdxFiles(CONTENT).flatMap((page) => {
    const within = relative(CONTENT, page);

    return fencesIn(
      expandRegions(readFileSync(page, 'utf8'), workspaceRoot, page),
      relative(workspaceRoot, page),
      within.split(sep)[0] as string,
    );
  });
}

/** The names an import clause binds, by the name the module exports them as. */
function importedNames(clause: string): string[] {
  const braced = clause.match(/\{([^}]*)\}/)?.[1];
  if (braced === undefined) {
    // `* as x` binds the namespace and names no export; a bare identifier is
    // the default import, which the module has to export as `default`.
    return /^\*\s+as\s/.test(clause.trim()) ? [] : ['default'];
  }

  return braced
    .split(',')
    .map(
      (part) =>
        part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0],
    )
    .filter((name): name is string => Boolean(name));
}

const sorted = (lines: readonly string[]): string[] => [...lines].sort();

/** Every `import … from '@evanion/…'` across a set of fences. */
function* importsIn(all: readonly Fence[]): Generator<{
  page: string;
  info: string;
  clause: string;
  specifier: string;
}> {
  for (const { page, info, code } of all) {
    for (const [, clause, specifier] of code.matchAll(IMPORT)) {
      yield {
        page,
        info,
        clause: clause as string,
        specifier: specifier as string,
      };
    }
  }
}

describe('fences that name a package export', () => {
  const all = fences();

  it('finds the fences', () => {
    expect(all.length).toBeGreaterThan(0);
    expect(
      all.filter(({ code }) => [...code.matchAll(IMPORT)].length > 0).length,
    ).toBeGreaterThan(0);
  });

  it('imports only names the package exports', async () => {
    const found = [...importsIn(all)];
    const known = await exportsBySpecifier(
      found.map(({ specifier }) => specifier),
    );
    const failures: string[] = [];

    for (const { page, info, clause, specifier } of found) {
      if ((await sourceFor(specifier)) === null) {
        failures.push(
          `${page} [${info}]: ${specifier} is not an entry point any package ` +
            `in this workspace publishes. Check the \`exports\` map of the ` +
            `package the specifier names.`,
        );
        continue;
      }

      const exported = known.get(specifier);
      if (!exported) continue;

      for (const name of importedNames(clause)) {
        if (!exported.has(name)) {
          failures.push(
            `${page} [${info}]: ${specifier} does not export \`${name}\``,
          );
        }
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * A diagram naming a symbol is the one place a rename leaves no compile error
   * behind, because a `mermaid` fence is drawn rather than run. It catches a
   * renamed symbol and it says nothing about whether the diagram is still true;
   * § 12 lists that as a reading.
   */
  it('names only packages and exports in a mermaid diagram', async () => {
    const diagrams = all.filter(
      ({ info }) => info.split(/\s+/)[0] === 'mermaid',
    );
    const references = diagrams.flatMap(({ page, code }) =>
      [...code.matchAll(DIAGRAM_REFERENCE)].map(([, specifier, symbol]) => ({
        page,
        specifier: specifier as string,
        symbol,
      })),
    );
    const known = await exportsBySpecifier(
      references.map(({ specifier }) => specifier),
    );
    const failures: string[] = [];

    for (const { page, specifier, symbol } of references) {
      if ((await sourceFor(specifier)) === null) {
        failures.push(
          `${page} [mermaid]: names ${specifier}, which is not an entry point ` +
            `any package in this workspace publishes`,
        );
        continue;
      }

      const exported = known.get(specifier);
      if (exported && symbol !== undefined && !exported.has(symbol)) {
        failures.push(
          `${page} [mermaid]: ${specifier} does not export \`${symbol}\``,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });

  /**
   * Decision 8 spells an API reference's `##` heading as the export, so the
   * heading above a `signature` fence is a symbol name and is comparable
   * against the export list with no parsing of the fence at all.
   *
   * The list a heading is held to is the section's own package plus every
   * package the page imports from, which is what lets `acl` document a
   * `@evanion/react-acl` hook on a page in the `acl` section.
   */
  it('documents a symbol the package exports in a signature fence', async () => {
    const bySlug = new Map((await packages()).map((it) => [it.slug, it.name]));
    const failures: string[] = [];

    const imported = new Map<string, Set<string>>();
    for (const { page, specifier } of importsIn(all)) {
      const file = page.slice(0, page.lastIndexOf(':'));
      imported.set(file, (imported.get(file) ?? new Set()).add(specifier));
    }

    const byPackage = await exportsBySpecifier([
      ...bySlug.values(),
      ...[...imported.values()].flatMap((it) => [...it]),
    ]);

    for (const { page, info, slug, heading } of all) {
      if (info.split(/\s+/)[0] !== 'signature') continue;

      if (heading === null) {
        failures.push(
          `${page} [${info}]: sits under no \`##\` heading naming a symbol in ` +
            `backticks. Decision 8 spells the heading as the export.`,
        );
        continue;
      }

      // `provider(component, props)` and `Policy<Schema>` both document a
      // symbol; the export list carries the name, not the call.
      const symbol = heading.split(/[(<\s]/)[0] as string;
      const file = page.slice(0, page.lastIndexOf(':'));
      const specifiers = [
        ...new Set([
          ...(bySlug.has(slug) ? [bySlug.get(slug) as string] : []),
          ...(imported.get(file) ?? []),
        ]),
      ];

      if (
        !specifiers.some((specifier) => byPackage.get(specifier)?.has(symbol))
      ) {
        failures.push(
          `${page} [${info}]: no package on this page exports \`${symbol}\`. ` +
            `Looked in ${specifiers.join(', ') || '(no package)'}.`,
        );
      }
    }

    expect(sorted(failures)).toEqual([]);
  });
});
