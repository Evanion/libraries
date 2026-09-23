import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';

import { internalMark, resolveAlias } from '@evanion/doc-examples/declarations';

/**
 * The released packages, their entry points, and the names each one publishes.
 *
 * `doc-export-coverage.test.ts` holds every export to a heading and every
 * callable one to a fence that runs; `doc-behaviour.test.ts` holds every
 * non-error callable one to a `describe` that names it. The two read different
 * evidence and answer different questions, so they are separate checks with
 * separate Nx cache keys, and the one thing they share is this: which packages
 * are released, which entry points they publish, and what the type checker says
 * each export is. Copying that a third time is how two checks start disagreeing
 * about what a package exports.
 */

const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');

/** What `apps/docs/app/navigation.ts` exports, restated rather than imported. */
export interface DocumentedPackage {
  name: string;
  root: string;
  slug: string;
}

export async function packages(): Promise<readonly DocumentedPackage[]> {
  const module_ = (await import(pathToFileURL(NAVIGATION).href)) as {
    packages: readonly DocumentedPackage[];
  };
  return module_.packages;
}

/** One published entry point, with the TypeScript source behind it. */
export interface Entry {
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
export function entriesOf(item: DocumentedPackage): Entry[] {
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
export interface Exported {
  name: string;
  /** Whether a caller can call or construct it. */
  callable: boolean;
  /** Whether its docblock carries `@internal`. */
  internal: boolean;
  /** Its docblock's prose, which is where an `@internal` states its reason. */
  reason: string;
  /** Whether it carries a docblock of its own in the library's source. */
  explained: boolean;
  /**
   * The file the name is declared in, which is not always a file of the package
   * that publishes it. `@evanion/astro-widget` and `@evanion/react-widget` both
   * re-export `validateItems` from `@evanion/widget`, and a check that asks
   * something of the declaration has to ask it where the declaration is.
   */
  declaredIn: string | null;
}

/**
 * Every name an entry point exports, with the callables marked.
 *
 * One program over every entry at once, with `@evanion/*` mapped to source, so
 * a name one package re-exports from another resolves rather than arriving as
 * an unresolved alias whose kind cannot be read.
 */
export function exportsOf(entries: readonly Entry[]): Map<string, Exported[]> {
  const paths: Record<string, string[]> = {};
  for (const entry of entries) {
    if (entry.specifier === entry.package)
      paths[entry.package] = [entry.source];
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
        const resolved = resolveAlias(each, checker);
        const type = checker.getTypeOfSymbolAtLocation(resolved, source);
        const callable =
          Boolean(resolved.getFlags() & ts.SymbolFlags.Value) &&
          (type.getCallSignatures().length > 0 ||
            type.getConstructSignatures().length > 0);
        const marked = internalMark(each, resolved, checker);
        // An overloaded function carries its documentation on the overloads a
        // caller resolves to, not on the implementation signature below them,
        // which is what an editor shows and what the reference reads.
        const prose = [
          ts.displayPartsToString(each.getDocumentationComment(checker)),
          ts.displayPartsToString(resolved.getDocumentationComment(checker)),
        ]
          .map((text) => text.trim())
          .filter(Boolean)
          .join(' ');
        return {
          name: each.getName(),
          callable,
          internal: marked !== null,
          reason: marked ?? '',
          explained: prose.length > 0,
          declaredIn:
            resolved.getDeclarations()?.[0]?.getSourceFile().fileName ?? null,
        };
      }),
    );
  }

  return found;
}
