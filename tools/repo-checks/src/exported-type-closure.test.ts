import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * A published declaration names no type its own file keeps private.
 *
 * `Cond` shipped as `{ readonly node: Node }` with `Node` declared in the same
 * file and not exported. A consumer could name `Cond` and could not name the
 * type of its only member, so the published surface had a hole in it that
 * nothing reported.
 *
 * The failure is worse than a hole, because it is silent in the one place it
 * shows. A declaration re-emitted somewhere that re-declares the name binds it
 * to whatever is in scope there: the documentation loader printed
 * `readonly node: Node` into a fence, `Node` resolved to the DOM's, and
 * TypeScript reported nothing. The reference documented a browser node for as
 * long as that entry existed.
 *
 * The rule is the closure: if an exported declaration names a type, that type
 * is exported from the file that declares it. A name reachable from outside
 * must be reachable by the caller too.
 *
 * Read off `src` rather than off `dist`, so the check needs no build and points
 * at the line an author would edit. The declaration emitter carries the same
 * references through, which is why the built `.d.ts` had the same hole.
 */

const NAVIGATION = join(workspaceRoot, 'apps/docs/app/navigation.ts');

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

/** Every entry point a package publishes that resolves to TypeScript. */
function entriesOf(item: DocumentedPackage): string[] {
  const manifest = JSON.parse(
    readFileSync(join(workspaceRoot, item.root, 'package.json'), 'utf8'),
  ) as { exports?: Record<string, unknown> };
  const found: string[] = [];

  for (const [pattern, target] of Object.entries(manifest.exports ?? {})) {
    if (pattern.includes('*')) continue;
    const source =
      typeof target === 'string'
        ? target
        : ((target as Record<string, string> | null)?.['@evanion/source'] ??
          null);
    if (source === null || !/\.tsx?$/.test(source)) continue;
    found.push(join(workspaceRoot, item.root, source));
  }

  return found;
}

/** Whether a declaration carries `export`. */
function isExported(node: ts.Node): boolean {
  const flags = ts.getCombinedModifierFlags(node as ts.Declaration);
  if (flags & ts.ModifierFlags.Export) return true;
  // An `export { X }` statement exports a declaration written without the
  // keyword, which is how a barrel re-exports a local name.
  const source = node.getSourceFile();
  const name = (node as { name?: ts.Identifier }).name?.text;
  if (name === undefined) return false;

  return source.statements.some(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) => (element.propertyName ?? element.name).text === name,
      ),
  );
}

/**
 * Names the rule reports and the repository accepts, each with its reason.
 *
 * Kept inline rather than in a file of its own: two entries do not need a
 * ratchet, and a reason a reader meets beside the rule is likelier to be
 * argued with than one in a JSON list.
 */
const ACCEPTED: Readonly<Record<string, string>> = {
  'libs/compose/src/Compose.types.ts: ValidateProvider names ComposeError':
    'A carrier for a compile-time message. Its name reaches a consumer in ' +
    'diagnostic text and never in code they write, so nothing is lost by it ' +
    'being unnameable and exporting it would publish a type with no use.',
};

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('the exported type closure', () => {
  it('names no type its own file keeps private', async () => {
    const entries = (await packages()).flatMap(entriesOf);
    const program = ts.createProgram(entries, {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      noEmit: true,
    });
    const checker = program.getTypeChecker();
    const failures: string[] = [];
    const seen = new Set<string>();

    for (const source of program.getSourceFiles()) {
      if (source.isDeclarationFile) continue;
      if (!source.fileName.includes(`${workspaceRoot}/libs/`)) continue;

      const moduleSymbol = checker.getSymbolAtLocation(source);
      if (!moduleSymbol) continue;

      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const resolved =
          exported.getFlags() & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exported)
            : exported;

        for (const declaration of resolved.getDeclarations() ?? []) {
          // Only the file that declares the exported name is walked, so a name
          // re-exported through a barrel is checked once, where it lives.
          if (declaration.getSourceFile() !== source) continue;

          const visit = (node: ts.Node): void => {
            // A body is not published. Only the signature crosses the module
            // boundary, so a type a function names inside itself stays private
            // and is right to be.
            if (ts.isBlock(node)) return;
            // A private member's type is dropped by the declaration emitter,
            // which writes `private storage;` and nothing about what it holds,
            // so it never reaches a consumer to be unnameable.
            if (
              (ts.isPropertyDeclaration(node) ||
                ts.isMethodDeclaration(node)) &&
              ts.getCombinedModifierFlags(node).valueOf() &
                ts.ModifierFlags.Private
            ) {
              return;
            }
            if (ts.isTypeReferenceNode(node)) {
              const name = ts.isQualifiedName(node.typeName)
                ? node.typeName.right
                : node.typeName;
              const found = checker.getSymbolAtLocation(name);
              // An import binds the name locally; the question is about the
              // module it came from, which is nameable wherever that module is.
              const referenced =
                found && found.getFlags() & ts.SymbolFlags.Alias
                  ? checker.getAliasedSymbol(found)
                  : found;

              for (const site of referenced?.getDeclarations() ?? []) {
                // A type parameter is declared by the declaration being
                // checked, so it travels with it and needs no export.
                if (ts.isTypeParameterDeclaration(site)) continue;
                // A type from another module, or from a lib file, is somebody
                // else's export and is nameable wherever that module is.
                if (site.getSourceFile() !== source) continue;
                if (isExported(site)) continue;

                const where = `${source.fileName.replace(`${workspaceRoot}/`, '')}`;
                const key = `${where}: ${exported.getName()} names ${name.text}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (key in ACCEPTED) continue;
                failures.push(
                  `${where}: exported \`${exported.getName()}\` names ` +
                    `\`${name.text}\`, which the same file does not export. A ` +
                    `consumer can name the first and not the second, and a ` +
                    `re-emitted declaration binds the name to whatever is in ` +
                    `scope where it lands.`,
                );
              }
            }
            ts.forEachChild(node, visit);
          };

          visit(declaration);
        }
      }
    }

    expect(sorted(failures)).toEqual([]);
  });
});
