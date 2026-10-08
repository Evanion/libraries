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

/**
 * Every module specifier a file names.
 *
 * Four forms name one: `from 'pg'`, `import 'pg'`, `import('pg')` and
 * `require('pg')`. A scan that read the first form alone would pass a core
 * that reached a driver through any of the other three.
 */
const SPECIFIER = /\b(?:from|import|require)\b\s*\(?\s*['"]([^'"]+)['"]/g;

interface ForeignImport {
  readonly path: string;
  readonly specifier: string;
}

/** Every specifier under `directory` that names a module outside the package. */
function foreignImports(directory: string): ForeignImport[] {
  return sources(directory)
    .flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(SPECIFIER)].map((match) => ({
        path,
        specifier: match[1] as string,
      })),
    )
    .filter((each) => !each.specifier.startsWith('.'));
}

/** The calls that start a timer or open a socket. */
const RUNTIME_CALLS = [
  /setInterval/,
  /setTimeout/,
  /setImmediate/,
  /\bfetch\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
];

/** Every timer or socket call the files under `directory` name. */
function runtimeOffences(directory: string): string[] {
  return sources(directory).flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return RUNTIME_CALLS.filter((pattern) => pattern.test(text)).map(
      (pattern) => `${path}: ${String(pattern)}`,
    );
  });
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

    const patterns = runtimeOffences(root).map(
      (offence) => offence.split(': ')[1],
    );

    expect(patterns).toEqual(RUNTIME_CALLS.map((pattern) => String(pattern)));
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

  it('reports one offence per pattern, not per occurrence', () => {
    const root = tree({
      'poller.ts': 'setTimeout(a, 1);\nsetTimeout(b, 2);\n',
    });

    expect(runtimeOffences(root)).toHaveLength(1);
  });

  it('reports no call a test file names', () => {
    const root = tree({ 'poller.spec.ts': 'setInterval(a, 1000);\n' });

    expect(runtimeOffences(root)).toEqual([]);
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
