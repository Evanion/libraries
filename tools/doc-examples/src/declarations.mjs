import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

import ts from 'typescript';

/**
 * What a package's own declarations say about one export: its kind, its
 * docblock and its block tags.
 *
 * The compiler is the source. A reference page that restates a signature by
 * hand carries a second copy of it, and the copy is the one that goes stale
 * while reading as authoritative.
 *
 * Declarations are read from the package's `dist/`, through the `types`
 * condition of its own `exports` map, rather than from `src/` through the
 * `@evanion/source` condition the workspace sets. The docs app already made
 * that choice for itself -- `apps/docs/tsconfig.json` sets `customConditions:
 * []` with a comment saying the site documents the published surface -- and a
 * reference page documenting something a reader cannot install is worse than
 * one that cannot link to a line of source. `nx.json` orders the libraries'
 * builds ahead of the docs app's, so the declarations exist by the time this
 * runs.
 *
 * `commentText` and `internalMark` were written for
 * `tools/repo-checks/src/doc-export-coverage.test.ts` and moved here so that
 * the loader and the guard read a docblock the same way. That test imports
 * them from this module.
 */

/** A package resolved once, with its program and checker held for reuse. */
const programs = new Map();

/** An export, as the reference page needs it. */
const NAMING_TAGS = new Set([
  'param',
  'returns',
  'return',
  'default',
  'defaultvalue',
  'deprecated',
  'see',
  'throws',
]);

/**
 * A JSDoc comment as text. It arrives as a string, or as nodes once the block
 * carries an inline tag such as a `{@link}`.
 */
export function commentText(comment) {
  if (comment === undefined) return '';
  if (typeof comment === 'string') return comment;
  return comment.map((part) => part.text ?? '').join('');
}

/** A symbol's target when it is a re-export, and the symbol otherwise. */
export function resolveAlias(symbol, checker) {
  return symbol.getFlags() & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
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
export function internalMark(symbol, resolved, checker) {
  const nodes = [
    ...(symbol.getDeclarations() ?? []),
    ...(resolved.getDeclarations() ?? []),
  ].flatMap((node) => [node, node.parent, node.parent?.parent]);

  for (const node of nodes) {
    if (!node) continue;
    for (const tag of ts.getJSDocTags(node)) {
      if (tag.tagName.text.toLowerCase() !== 'internal') continue;
      const block = tag.parent;
      return [commentText(block.comment), commentText(tag.comment)]
        .map((text) => text.trim())
        .filter(Boolean)
        .join(' ');
    }
  }

  // A tag the checker reports but no node carries, which happens for a symbol
  // whose declaration is in a file outside this program.
  const reported = [
    ...symbol.getJsDocTags(checker),
    ...resolved.getJsDocTags(checker),
  ].find((tag) => tag.name.toLowerCase() === 'internal');
  return reported ? ts.displayPartsToString(reported.text ?? []) : null;
}

/** Raised where a reference names something the compiler cannot find. */
export class DeclarationError extends Error {}

/**
 * The declaration file a specifier resolves to, and the directory of the
 * package that publishes it.
 *
 * Resolved through Node from the workspace root, so a package is found by the
 * name it publishes under and nothing here holds a list of packages.
 */
function entryOf(root, specifier) {
  const match = /^(@[^/]+\/[^/]+|[^@/][^/]*)(\/.*)?$/.exec(specifier);
  if (!match) {
    throw new DeclarationError(`'${specifier}' is not a package specifier`);
  }

  const [, name, subpath = ''] = match;
  const require_ = createRequire(join(root, 'index.js'));
  let manifestPath;
  try {
    manifestPath = require_.resolve(`${name}/package.json`);
  } catch {
    throw new DeclarationError(`no package named '${name}' is installed`);
  }

  const packageDir = dirname(manifestPath);
  const manifest = JSON.parse(ts.sys.readFile(manifestPath) ?? '{}');
  const target = (manifest.exports ?? {})[subpath === '' ? '.' : `.${subpath}`];
  const types =
    typeof target === 'string' ? target : (target?.types ?? target?.default);

  if (typeof types !== 'string') {
    throw new DeclarationError(
      `'${name}' publishes no '${subpath || '.'}' entry with declarations`,
    );
  }

  return { packageDir, declaration: join(packageDir, types) };
}

/** The program over one entry point, built once and kept. */
function programOf(root, specifier) {
  const held = programs.get(specifier);
  if (held) return held;

  const { packageDir, declaration } = entryOf(root, specifier);
  if (!ts.sys.fileExists(declaration)) {
    throw new DeclarationError(
      `'${specifier}' resolves to ${relative(root, declaration)}, which does ` +
        `not exist. The package has to be built before the docs app is.`,
    );
  }

  const program = ts.createProgram([declaration], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });

  const built = {
    packageDir,
    declaration,
    program,
    checker: program.getTypeChecker(),
  };
  programs.set(specifier, built);
  return built;
}

/**
 * What an export is, from the kind of its first declaration.
 *
 * An error is its own kind rather than a class, which the repository's own
 * export lists settle: 38 classes whose name ends `Error` against 4 that do
 * not, and every documented package carries an `errors.mdx`. A `const` holding
 * a function is a function, because what a reader does with it is call it.
 */
function kindOf(resolved, checker, at) {
  const declaration = resolved.getDeclarations()?.[0];
  if (!declaration) return 'constant';

  switch (declaration.kind) {
    case ts.SyntaxKind.InterfaceDeclaration:
      return 'interface';
    case ts.SyntaxKind.TypeAliasDeclaration:
      return 'typeAlias';
    case ts.SyntaxKind.FunctionDeclaration:
      return 'function';
    case ts.SyntaxKind.ClassDeclaration:
      return resolved.getName().endsWith('Error') ? 'error' : 'class';
    default: {
      const type = checker.getTypeOfSymbolAtLocation(resolved, at);
      return type.getCallSignatures().length > 0 ? 'function' : 'constant';
    }
  }
}

const printer = ts.createPrinter({ removeComments: true });

/**
 * The declaration the package published, as source a Twoslash fence compiles.
 *
 * Printed from the `.d.ts` rather than queried through Twoslash's `^?`. A
 * query renders as an overlay inside the `<pre>`, which cannot wrap: the
 * `hydratePolicy` signature is 154 characters on one line and the overlay
 * clips it. Printing also answers the two cases a query cannot. `^?` over an
 * interface's own name returns the name, so an interface entry would show its
 * identity and not its fields, and a query reports no constructor at all, so a
 * reader asking what to pass `new InvalidConditionError(...)` would get
 * nothing.
 *
 * A printed declaration names types the fence has to import or it will not
 * compile, so the names it mentions are intersected with the entry point's own
 * export list and imported. A type parameter is not an export, so `Sub` and
 * `Keys` fall out without being reasoned about. A declaration naming a type the
 * package does not publish fails `next build`, which is the right direction: a
 * reference entry a reader cannot type out is a reference entry that is wrong.
 */
function declarationOf(resolved, exported, name) {
  const declaration = resolved.getDeclarations()?.[0];
  if (!declaration) return null;

  // A `const` is declared inside a statement, and the statement is what
  // carries `declare` and the export modifier.
  const node = ts.isVariableDeclaration(declaration)
    ? declaration.parent.parent
    : declaration;
  const text = printer.printNode(
    ts.EmitHint.Unspecified,
    node,
    node.getSourceFile(),
  );

  const mentioned = new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? []);
  const referenced = [...exported.keys()].filter(
    (each) => each !== name && mentioned.has(each),
  );

  return {
    text,
    values: referenced.filter((each) => exported.get(each)),
    types: referenced.filter((each) => !exported.get(each)),
  };
}

/** Splits a docblock into its first paragraph and everything after it. */
function paragraphs(text) {
  const trimmed = text.trim().replace(/\r\n/g, '\n');
  const at = trimmed.indexOf('\n\n');
  if (at === -1) return { summary: trimmed, rest: '' };
  return {
    summary: trimmed.slice(0, at).trim(),
    rest: trimmed.slice(at).trim(),
  };
}

/**
 * One export, as a reference entry needs it.
 *
 * `readme` is workspace relative so that an example reference survives the page
 * moving between directories.
 */
export function readReference(root, specifier, name) {
  const { packageDir, declaration, program, checker } = programOf(
    root,
    specifier,
  );
  const source = program.getSourceFile(declaration);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);

  if (!moduleSymbol) {
    throw new DeclarationError(`'${specifier}' exports nothing`);
  }

  // Every export of the entry point, with whether a caller can import it
  // without `import type`. The signature fence imports from this list, so the
  // package's own surface decides what a fence may name.
  const exported = new Map(
    checker.getExportsOfModule(moduleSymbol).map((each) => {
      const target = resolveAlias(each, checker);
      return [
        each.getName(),
        Boolean(target.getFlags() & ts.SymbolFlags.Value),
      ];
    }),
  );

  const symbol = checker
    .getExportsOfModule(moduleSymbol)
    .find((each) => each.getName() === name);

  if (!symbol) {
    throw new DeclarationError(`'${specifier}' does not export '${name}'`);
  }

  const resolved = resolveAlias(symbol, checker);
  const { summary, rest } = paragraphs(
    ts.displayPartsToString(resolved.getDocumentationComment(checker)),
  );

  const tags = resolved
    .getJsDocTags(checker)
    .filter((tag) => NAMING_TAGS.has(tag.name.toLowerCase()))
    .map((tag) => ({
      name: tag.name.toLowerCase(),
      text: ts.displayPartsToString(tag.text ?? []).trim(),
    }));

  return {
    name,
    specifier,
    kind: kindOf(resolved, checker, source),
    signature: declarationOf(resolved, exported, name),
    summary,
    rest,
    tags,
    declaration,
    readme: relative(root, join(packageDir, 'README.md')).split('\\').join('/'),
  };
}
