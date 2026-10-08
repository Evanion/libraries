import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

/** Every source file the package publishes, test files excluded. */
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    // Every extension a bundler resolves, not `.ts` and `.tsx` alone. A
    // `source.mts` that imports a driver is the violation this file refuses,
    // under a name a narrower pattern reads as data.
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    if (/\.(spec|test|test-d)\./.test(entry.name)) return [];
    // `vite.config.ts` names this file in the React project's `setupFiles` and
    // `package.json`'s `files` negates it, so it is a test file whose name
    // carries no `.spec.` or `.test.` segment.
    if (entry.name === 'test-setup.ts') return [];
    return [path];
  });
}

/** One source file, parsed. */
function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
  );
}

/** `node` and every node below it, tokens and trivia excluded. */
function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/**
 * Every module specifier a file names, read off its syntax.
 *
 * Six clauses name one: `import 'pg'`, `from 'pg'`, `export … from 'pg'`,
 * `import('pg')`, `import('pg').Pool` in a type position, and `require('pg')`.
 * A scan that read one clause alone would pass a core that reached a driver
 * through any of the others.
 *
 * The parser is here because the text is not the code. `Converts from
 * 'instant' to a Date` in a docblock, the import line an `@example` opens
 * with, and `type Op = 'from' | 'in'` each put the word beside a quote without
 * importing anything, and this package writes all three. A scan over raw text
 * reports them as driver imports and names a module the file does not have.
 */
function specifiersOf(source: ts.SourceFile): string[] {
  const found: string[] = [];

  const push = (node: ts.Node | undefined): void => {
    if (node !== undefined && ts.isStringLiteralLike(node))
      found.push(node.text);
  };

  walk(source, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      push(node.moduleSpecifier);
      return;
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      push(node.moduleReference.expression);
      return;
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      push(node.argument.literal);
      return;
    }
    if (!ts.isCallExpression(node)) return;
    if (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require')
    ) {
      push(node.arguments[0]);
    }
  });

  return found;
}

interface ForeignImport {
  readonly path: string;
  readonly specifier: string;
}

/** Every specifier under `directory` that names a module outside the package. */
function foreignImports(directory: string): ForeignImport[] {
  return sources(directory)
    .flatMap((path) =>
      specifiersOf(parse(path)).map((specifier) => ({ path, specifier })),
    )
    .filter((each) => !each.specifier.startsWith('.'));
}

/** The names that start a timer or open a socket. */
const RUNTIME_CALLS = [
  'setInterval',
  'setTimeout',
  'setImmediate',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
] as const;

/**
 * Every timer or socket name a file reaches for, read off its syntax.
 *
 * A name counts wherever the code names it. `setInterval(…)`, `new
 * WebSocket(…)`, `globalThis.setTimeout` and `const later = setTimeout` all
 * reach the same host facility, and a rule that asked for the call parens
 * would pass the last two.
 *
 * The parser is here for the same reason it is on the import scan: a docblock
 * that writes the word names nothing. `config.ts` documents the poller
 * `@evanion/feature-source` owns, so it is the file most likely to write
 * `setInterval` in prose, and the sentence saying the core opens no
 * `WebSocket` must not be the thing that fails the assertion.
 */
function runtimeNamesOf(source: ts.SourceFile): string[] {
  const watched: ReadonlySet<string> = new Set(RUNTIME_CALLS);
  const found = new Set<string>();

  walk(source, (node) => {
    if (ts.isPropertyAccessExpression(node) && watched.has(node.name.text)) {
      found.add(node.name.text);
      return;
    }
    if (ts.isIdentifier(node) && watched.has(node.text)) found.add(node.text);
  });

  return RUNTIME_CALLS.filter((name) => found.has(name));
}

/** Every timer or socket call the files under `directory` name. */
function runtimeOffences(directory: string): string[] {
  return sources(directory).flatMap((path) =>
    runtimeNamesOf(parse(path)).map((name) => `${path}: ${name}`),
  );
}

/** The manifest members this file reads. */
interface Manifest {
  readonly dependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly bundledDependencies?: string[];
  readonly bundleDependencies?: string[];
  readonly peerDependencies?: Record<string, string>;
}

/**
 * Every package a manifest installs for a consumer.
 *
 * The first case reads `dependencies`. An adapter declared under
 * `optionalDependencies` or either spelling of `bundledDependencies` reaches a
 * consumer's bundle as well, so all four fields answer here.
 * `peerDependencies` is the application's own install and the case below holds
 * it to `react` alone.
 */
function installedPackages(manifest: Manifest): string[] {
  const fields: readonly [
    string,
    Record<string, string> | string[] | undefined,
  ][] = [
    ['dependencies', manifest.dependencies],
    ['optionalDependencies', manifest.optionalDependencies],
    ['bundledDependencies', manifest.bundledDependencies],
    ['bundleDependencies', manifest.bundleDependencies],
  ];

  return fields.flatMap(([field, declared]) => {
    if (declared === undefined) return [];
    const names = Array.isArray(declared) ? declared : Object.keys(declared);
    return names.map((name) => `${field}: ${name}`);
  });
}

/** The package manifest, parsed. */
function manifest(): Manifest {
  return JSON.parse(
    readFileSync(join(ROOT, '../package.json'), 'utf8'),
  ) as Manifest;
}

/** The fixture trees a case wrote, removed after it. */
const written: string[] = [];

/** A tree of files, written from a map of relative path to text. */
function tree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'feature-core-boundary-'));
  written.push(root);

  for (const [path, text] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text, 'utf8');
  }

  return root;
}

/** Paths named from a fixture root, so a case asserts on no host path. */
function named(root: string, paths: readonly string[]): string[] {
  return paths.map((path) => relative(root, path).split('\\').join('/')).sort();
}

afterEach(() => {
  while (written.length > 0) {
    rmSync(written.pop() as string, { recursive: true, force: true });
  }
});

describe('the core', () => {
  it('declares no runtime dependency', () => {
    // A browser bundle of this package must not contain a Postgres driver, and
    // a React Native bundle must not contain a Node `http` import. Every
    // adapter that reads configuration from somewhere lives in a sibling
    // package. § 9.
    expect(manifest().dependencies).toBeUndefined();
  });

  it('installs no package for a consumer', () => {
    expect(installedPackages(manifest())).toEqual([]);
  });

  it('keeps react its only peer', () => {
    // A driver declared as a peer reaches the same bundle, and the application
    // installs it. `react` is the one peer this package asks for, and
    // `peerDependenciesMeta` marks it optional.
    expect(Object.keys(manifest().peerDependencies ?? {})).toEqual(['react']);
  });

  it('imports no module outside itself', () => {
    const foreign = foreignImports(ROOT).filter(
      (each) => !each.path.includes(join('src', 'react')),
    );

    expect(foreign).toEqual([]);
  });

  it('starts no timer and opens no socket', () => {
    // The core holds no clock authority and performs no fetch. The party that
    // fetches is the party that acts on `maxStale`, and it lives in
    // `@evanion/feature-source`. § 1, § 9.
    expect(runtimeOffences(ROOT)).toEqual([]);
  });
});

describe('the react entry', () => {
  it('imports react and nothing else foreign', () => {
    // The case above exempts this directory, because `react` is a peer and the
    // entry imports it. The exemption covers one specifier, so a driver added
    // beside the hooks fails here.
    const specifiers = [
      ...new Set(foreignImports(join(ROOT, 'react')).map((e) => e.specifier)),
    ].sort();

    expect(specifiers).toEqual(['react']);
  });

  it('starts no timer and opens no socket either', () => {
    expect(runtimeOffences(join(ROOT, 'react'))).toEqual([]);
  });
});

describe('the files the scan reads', () => {
  it('reaches every entry the package publishes', () => {
    // Three assertions above read `[]` as a pass, so each one passes on a walk
    // that found no file at all. This names the modules the walk must reach.
    const paths = named(ROOT, sources(ROOT));

    expect(paths).toContain('index.ts');
    expect(paths).toContain('react/index.tsx');
    expect(paths).toContain('lib/config.ts');
    expect(paths).toContain('lib/features.ts');
  });

  it('reads no test file the package carries', () => {
    const tests = named(ROOT, sources(ROOT)).filter((path) =>
      /\.(spec|test|test-d)\.|test-setup/.test(path),
    );

    expect(tests).toEqual([]);
  });

  it('reads nothing from a tree that holds no file', () => {
    expect(sources(tree({}))).toEqual([]);
  });

  it('reads the one module a tree holds', () => {
    const root = tree({ 'only.ts': 'export const one = 1;\n' });

    expect(named(root, sources(root))).toEqual(['only.ts']);
  });

  it('reads a module nested below the root', () => {
    const root = tree({
      'top.ts': '',
      'inner/deep/low.ts': '',
    });

    expect(named(root, sources(root))).toEqual(['inner/deep/low.ts', 'top.ts']);
  });

  it('reads a module under every extension a bundler resolves', () => {
    const root = tree({
      'a.ts': '',
      'b.tsx': '',
      'c.mts': '',
      'd.cts': '',
      'e.js': '',
      'notes.md': 'setInterval',
      'data.json': '{}',
    });

    expect(named(root, sources(root))).toEqual([
      'a.ts',
      'b.tsx',
      'c.mts',
      'd.cts',
      'e.js',
    ]);
  });

  it('reads no spec, type test or setup file a tree holds', () => {
    const root = tree({
      'a.spec.ts': "import pg from 'pg';\n",
      'a.test.ts': "import pg from 'pg';\n",
      'a.test-d.ts': "import pg from 'pg';\n",
      'b.spec.tsx': "import pg from 'pg';\n",
      'test-setup.ts': "import pg from 'pg';\n",
    });

    expect(sources(root)).toEqual([]);
  });
});

describe('the imports the scan reports', () => {
  it('reports a bare specifier', () => {
    const root = tree({ 'store.ts': "import { Pool } from 'pg';\n" });

    expect(
      named(
        root,
        foreignImports(root).map((e) => e.path),
      ),
    ).toEqual(['store.ts']);
    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a specifier a side-effect import names', () => {
    const root = tree({ 'store.ts': "import 'pg';\n" });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a specifier a dynamic import names', () => {
    const root = tree({
      'store.ts': "export const open = () => import('pg');\n",
    });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a specifier require names', () => {
    const root = tree({ 'store.cts': "const pg = require('pg');\n" });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a double-quoted specifier', () => {
    const root = tree({ 'store.ts': 'import { Pool } from "pg";\n' });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a node builtin', () => {
    // A builtin is a module outside the package, and `node:http` in the core is
    // the socket decision 13 refuses. A React Native bundle resolves neither.
    const root = tree({ 'store.ts': "import { get } from 'node:http';\n" });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['node:http']);
  });

  it('reports one entry per occurrence', () => {
    const root = tree({
      'store.ts':
        "import { Pool } from 'pg';\nimport type { Client } from 'pg';\n",
    });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg', 'pg']);
  });

  it('reports no relative specifier', () => {
    const root = tree({
      'store.ts':
        "import { a } from './a.js';\nimport { b } from '../b.js';\nexport * from './c.js';\n",
    });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports no specifier a test file names', () => {
    const root = tree({ 'store.spec.ts': "import { Pool } from 'pg';\n" });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports a specifier an export clause names', () => {
    const root = tree({ 'store.ts': "export { Pool } from 'pg';\n" });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports a specifier an import type names', () => {
    const root = tree({
      'store.ts': "export type P = import('pg').Pool;\n",
    });

    expect(foreignImports(root).map((e) => e.specifier)).toEqual(['pg']);
  });

  it('reports no specifier a docblock names', () => {
    // The two shapes this package writes. `config.ts` documents an instant it
    // converts from, and the `@example` fences on `features.ts` and
    // `react/index.tsx` open with the import line a reader would type.
    const root = tree({
      'config.ts': [
        "/** Converts from 'instant' to a Date. */",
        '/**',
        ' * @example',
        " * import { createFeatures } from '@evanion/feature';",
        ' */',
        'export const one = 1;',
      ].join('\n'),
    });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports no specifier a line comment names', () => {
    const root = tree({
      'store.ts':
        "// A holder reads from 'now' onward.\nexport const one = 1;\n",
    });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports no specifier a string literal union names', () => {
    const root = tree({ 'store.ts': "export type Op = 'from' | 'in';\n" });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports no specifier a string carrying an import line names', () => {
    const root = tree({
      'store.ts': 'export const line = "import { a } from \'pg\'";\n',
    });

    expect(foreignImports(root)).toEqual([]);
  });

  it('reports no specifier from a module that imports nothing', () => {
    const root = tree({ 'store.ts': 'export const one = 1;\n' });

    expect(foreignImports(root)).toEqual([]);
  });
});

describe('the timers and sockets the scan reports', () => {
  it('reports every call a module names', () => {
    const root = tree({
      'poller.ts': [
        'setInterval(() => undefined, 1000);',
        'setTimeout(() => undefined, 1000);',
        'setImmediate(() => undefined);',
        "fetch('https://example.test/config');",
        'new XMLHttpRequest();',
        "new WebSocket('wss://example.test');",
        "new EventSource('https://example.test/stream');",
      ].join('\n'),
    });

    const names = runtimeOffences(root).map(
      (offence) => offence.split(': ')[1],
    );

    expect(names).toEqual([
      'setInterval',
      'setTimeout',
      'setImmediate',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
    ]);
  });

  it('names the file each offence came from', () => {
    const root = tree({
      'clean.ts': 'export const one = 1;\n',
      'poller.ts': 'setInterval(() => undefined, 1000);\n',
    });

    const paths = runtimeOffences(root).map(
      (offence) => offence.split(': ')[0] as string,
    );

    expect(named(root, paths)).toEqual(['poller.ts']);
  });

  it('reports one offence per name, not per occurrence', () => {
    const root = tree({
      'poller.ts': 'setTimeout(a, 1);\nsetTimeout(b, 2);\n',
    });

    expect(runtimeOffences(root)).toHaveLength(1);
  });

  it('reports no call a test file names', () => {
    const root = tree({ 'poller.spec.ts': 'setInterval(a, 1000);\n' });

    expect(runtimeOffences(root)).toEqual([]);
  });

  it('reports a name a property access reaches', () => {
    const root = tree({
      'poller.ts': 'globalThis.setTimeout(() => undefined, 1);\n',
    });

    expect(runtimeOffences(root)).toHaveLength(1);
  });

  it('reports a name the module holds without calling it', () => {
    // `const later = setTimeout; later(f, 1)` starts the same timer, so the
    // reference is the boundary, not the parens after it.
    const root = tree({ 'poller.ts': 'export const later = setTimeout;\n' });

    expect(runtimeOffences(root)).toHaveLength(1);
  });

  it('reports nothing from a module that names no call', () => {
    const root = tree({
      // The prose a docblock writes about a fetch is not a fetch. `maxStale`
      // is documented in the core and acted on by the party that fetches.
      'config.ts':
        '/** The poller performs the fetch. */\nexport const ms = 1;\n',
    });

    expect(runtimeOffences(root)).toEqual([]);
  });

  it('reports no call a docblock names', () => {
    // Every name on the list, in the two sentences `config.ts` has the most
    // reason to write: what the source package owns, and what this one does
    // not do.
    const root = tree({
      'config.ts': [
        '/**',
        ' * The source package owns the WebSocket, the EventSource and the',
        ' * XMLHttpRequest. No setInterval, setTimeout or setImmediate runs',
        ' * here, and the core performs no fetch.',
        ' */',
        'export const ms = 1;',
      ].join('\n'),
    });

    expect(runtimeOffences(root)).toEqual([]);
  });

  it('reports no call a line comment names', () => {
    const root = tree({
      'config.ts': '// No setTimeout runs in the core.\nexport const ms = 1;\n',
    });

    expect(runtimeOffences(root)).toEqual([]);
  });

  it('reports no call a string literal names', () => {
    const root = tree({
      'config.ts': "export const owner = 'WebSocket';\n",
    });

    expect(runtimeOffences(root)).toEqual([]);
  });
});

describe('the dependencies the scan reports', () => {
  it('reports a package under dependencies', () => {
    expect(installedPackages({ dependencies: { pg: '^8.0.0' } })).toEqual([
      'dependencies: pg',
    ]);
  });

  it('reports a package under optionalDependencies', () => {
    expect(
      installedPackages({ optionalDependencies: { pg: '^8.0.0' } }),
    ).toEqual(['optionalDependencies: pg']);
  });

  it('reports a package under either spelling of bundledDependencies', () => {
    expect(
      installedPackages({
        bundledDependencies: ['pg'],
        bundleDependencies: ['undici'],
      }),
    ).toEqual(['bundledDependencies: pg', 'bundleDependencies: undici']);
  });

  it('reports every package a field holds', () => {
    expect(
      installedPackages({ dependencies: { pg: '^8.0.0', undici: '^6.0.0' } }),
    ).toEqual(['dependencies: pg', 'dependencies: undici']);
  });

  it('reports nothing from a manifest that declares no install field', () => {
    expect(installedPackages({})).toEqual([]);
  });

  it('reports nothing from an empty install field', () => {
    // An empty record installs nothing. The first case is the stricter one and
    // asks that `dependencies` be absent, which is what the manifest has.
    expect(installedPackages({ dependencies: {} })).toEqual([]);
  });

  it('reports no peer', () => {
    expect(
      installedPackages({ peerDependencies: { react: '^19.0.0' } }),
    ).toEqual([]);
  });
});
