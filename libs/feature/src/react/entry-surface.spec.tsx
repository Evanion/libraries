import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as core from '../index.js';
import * as reactEntry from './index.js';

/**
 * The react entry re-exports the document types and changes no runtime.
 *
 * A type-only re-export erases, so the runtime half of the claim is only
 * checkable against the module namespace a bundler builds. Those cases read
 * the key set: the provider, the four hooks and the binder, and no value the
 * core owns. A task that adds a hook to the adapter edits the list in the first
 * case, which is the point of spelling it.
 *
 * The names half is read off the sources instead, because nothing at runtime
 * holds it. `config.ts` is the one place the document vocabulary is declared,
 * and both entries are held to it: the react entry re-exports exactly those
 * names and no others, and the core entry re-exports every one of them. A name
 * added to one entry and forgotten on the other fails here, and so does a name
 * `config.ts` declares that neither entry publishes.
 *
 * Read off `src` with the parser alone, so the check needs no build and points
 * at the line an author would edit, on `exported-type-closure.test.ts`'s
 * reading. It asks that both entries spell their re-exports in a named clause:
 * `export type * from './lib/config.js'` carries no names for the clause reader
 * to collect and reports as the whole vocabulary missing. The repository's
 * export tooling reads these clauses too, so neither entry may drop them.
 *
 * The clause reader takes the type-only ones. A value the entry re-exports from
 * a module of its own is the runtime cases' business, and the names cases below
 * say nothing about it.
 *
 * `config-types.test-d.tsx` holds the third half: each name on the react entry
 * is the core entry's declaration and not a redeclaration beside it.
 */

const CORE_ENTRY = join(import.meta.dirname, '../index.ts');
const REACT_ENTRY = join(import.meta.dirname, 'index.tsx');
const CONFIG = join(import.meta.dirname, '../lib/config.ts');

/** The module `config.ts` resolves as, from the react entry. */
const CONFIG_SPECIFIER = '../lib/config.js';

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function read(file: string): ts.SourceFile {
  return parse(file, readFileSync(file, 'utf8'));
}

/** Every type a file declares with `export`, sorted. */
function declaredTypes(source: ts.SourceFile): string[] {
  const names: string[] = [];

  for (const statement of source.statements) {
    if (
      !ts.isTypeAliasDeclaration(statement) &&
      !ts.isInterfaceDeclaration(statement)
    ) {
      continue;
    }
    if (!(ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export)) {
      continue;
    }
    names.push(statement.name.text);
  }

  return names.sort();
}

/**
 * Every type an entry re-exports, against the module it comes from.
 *
 * Type-only clauses alone. `export type { … } from` marks the whole clause and
 * `export { type A, b } from` marks the element, and a clause carrying neither
 * mark re-exports a value, which no case here has an opinion about: the runtime
 * cases above read those names off the module namespace instead.
 */
function typeReExports(source: ts.SourceFile): Map<string, string> {
  const found = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const { exportClause, isTypeOnly, moduleSpecifier } = statement;
    if (moduleSpecifier === undefined) continue;
    if (!ts.isStringLiteral(moduleSpecifier)) continue;
    if (exportClause === undefined || !ts.isNamedExports(exportClause)) {
      continue;
    }
    for (const element of exportClause.elements) {
      if (!isTypeOnly && !element.isTypeOnly) continue;
      found.set(element.name.text, moduleSpecifier.text);
    }
  }

  return found;
}

/** The document vocabulary, which is what `config.ts` declares. */
const DOCUMENT_TYPES = declaredTypes(read(CONFIG));

/** The document functions a component file reaches the core entry for. */
const DOCUMENT_FUNCTIONS = [
  'configDigest',
  'parseFeatureConfig',
  'serializeConfig',
  'validateConfig',
] as const;

describe('the react entry at runtime', () => {
  it('exports the provider, the hooks and the binder, and nothing more', () => {
    expect(Object.keys(reactEntry).sort()).toEqual([
      'FeatureProvider',
      'createFeatureContext',
      'useFeature',
      'useFeatureEnabled',
      'useFeatures',
      'useVariant',
    ]);
  });

  it('holds a function at every name it exports, so no document rides along', () => {
    const kinds = Object.values(reactEntry).map((each) => typeof each);

    expect([...new Set(kinds)]).toEqual(['function']);
  });

  it('carries no value under any document type name, because the names erase', () => {
    const leaked = DOCUMENT_TYPES.filter((name) => name in reactEntry);

    expect(leaked).toEqual([]);
  });

  it('leaves the four document functions on the core, which publishes them', () => {
    const published = DOCUMENT_FUNCTIONS.filter((name) => name in core);
    const adapted = DOCUMENT_FUNCTIONS.filter((name) => name in reactEntry);

    expect({ published, adapted }).toEqual({
      published: [...DOCUMENT_FUNCTIONS],
      adapted: [],
    });
  });

  it('adds no name the core entry already publishes', () => {
    const shared = Object.keys(reactEntry).filter((name) => name in core);

    expect(shared).toEqual([]);
  });
});

describe('the names the react entry re-exports', () => {
  it('spells every document type config.ts declares and re-exports nothing else', () => {
    const named = [...typeReExports(read(REACT_ENTRY)).keys()].sort();

    expect(named).toEqual(DOCUMENT_TYPES);
  });

  it('takes each of them from the module that declares them', () => {
    const elsewhere = [...typeReExports(read(REACT_ENTRY))]
      .filter(([, specifier]) => specifier !== CONFIG_SPECIFIER)
      .map(([name, specifier]) => `${name} from ${specifier}`)
      .sort();

    expect(elsewhere).toEqual([]);
  });

  it('names what the core entry names, so one specifier reaches either of them', () => {
    const published = typeReExports(read(CORE_ENTRY));
    const absent = DOCUMENT_TYPES.filter((name) => !published.has(name));

    expect(absent).toEqual([]);
  });
});

describe('the clause reader', () => {
  it('reads a type-only clause', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        "export type { FeatureConfig } from '../lib/config.js';",
      ),
    );

    expect([...named]).toEqual([['FeatureConfig', '../lib/config.js']]);
  });

  it('leaves a value clause out, because a document type is never a value', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        [
          "export { useFeatureStore } from './hooks.js';",
          "export type { FeatureConfig } from '../lib/config.js';",
        ].join('\n'),
      ),
    );

    expect([...named]).toEqual([['FeatureConfig', '../lib/config.js']]);
  });

  it('leaves the value half of a mixed clause out and keeps the type half', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        "export { type FeatureConfig, useFeatureStore } from './hooks.js';",
      ),
    );

    expect([...named]).toEqual([['FeatureConfig', './hooks.js']]);
  });
});
