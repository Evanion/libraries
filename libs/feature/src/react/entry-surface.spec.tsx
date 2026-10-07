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
 * holds it. The rule is parity with the core entry: every document type the
 * core publishes from `config.ts` is on the react entry, from `config.ts`, and
 * the react entry publishes no `config.ts` type the core keeps to itself. A
 * name added to one entry and forgotten on the other fails here.
 *
 * `config.ts`'s own declaration set is not the rule, in either direction. A
 * type it exports so `exported-type-closure.test.ts` passes is not thereby
 * public, and the react entry is free to re-export a type from another module:
 * `ReloadResult.changed` and `ConfigIssue.key` are typed on `FeatureKey`,
 * which `types.ts` declares, and a component file annotating either one wants
 * that name on the entry it already imports. The spec's header names eight of
 * the document types, and one case holds the core to them, so the parity cases
 * cannot pass over a set that went empty.
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

/** The module `config.ts` resolves as, from each entry. */
const CORE_CONFIG_SPECIFIER = './lib/config.js';
const REACT_CONFIG_SPECIFIER = '../lib/config.js';

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

/** How an entry's document re-exports differ from the names it is held to. */
interface Parity {
  /** A name the entry does not publish, or publishes from somewhere else. */
  readonly absent: readonly string[];
  /** A name the entry publishes that the set does not carry. */
  readonly extra: readonly string[];
}

/**
 * Reads an entry against the document types it is held to.
 *
 * Both halves are scoped to `specifier`, the module `config.ts` resolves as
 * from that entry. A name the entry takes from any other module is a type of
 * another module's and no business of this rule: it is `extra` only when it
 * comes from `config.ts`, and it leaves a published name `absent` because the
 * name a component file imports has to be the core's declaration and not a
 * second one beside it.
 */
function parityWith(
  entry: ts.SourceFile,
  specifier: string,
  published: readonly string[],
): Parity {
  const named = typeReExports(entry);
  const absent = published
    .filter((name) => named.get(name) !== specifier)
    .map((name) => `${name} from ${named.get(name) ?? 'nowhere'}`)
    .sort();
  const extra = [...named]
    .filter(([name, from]) => from === specifier && !published.includes(name))
    .map(([name]) => name)
    .sort();

  return { absent, extra };
}

/** The document vocabulary, which is what `config.ts` declares. */
const DOCUMENT_TYPES = declaredTypes(read(CONFIG));

/** The document types the core entry publishes, read off its own clause. */
const CORE_DOCUMENT_TYPES = [...typeReExports(read(CORE_ENTRY))]
  .filter(([, specifier]) => specifier === CORE_CONFIG_SPECIFIER)
  .map(([name]) => name)
  .sort();

/** The document types the spec's header puts on the package, § header. */
const SPEC_DOCUMENT_TYPES = [
  'ConfigIssue',
  'ContextSchema',
  'FeatureConfig',
  'FeatureSchema',
  'FeatureShape',
  'ReloadResult',
  'SerializedInstant',
  'ValidationResult',
] as const;

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
  it('publishes what the core entry publishes, each one from config.ts itself', () => {
    const parity = parityWith(
      read(REACT_ENTRY),
      REACT_CONFIG_SPECIFIER,
      CORE_DOCUMENT_TYPES,
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('is held to a real set, because the core publishes the eight the spec names', () => {
    const missing = SPEC_DOCUMENT_TYPES.filter(
      (name) => !CORE_DOCUMENT_TYPES.includes(name),
    );

    expect(missing).toEqual([]);
  });
});

describe('the parity rule', () => {
  const PUBLISHED = ['FeatureConfig', 'ReloadResult'];

  function verdict(...clauses: readonly string[]): Parity {
    return parityWith(
      parse('entry.tsx', clauses.join('\n')),
      REACT_CONFIG_SPECIFIER,
      PUBLISHED,
    );
  }

  it('takes an entry publishing the core names from config.ts', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '../lib/config.js';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('takes a type the entry publishes from a module config.ts is not', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '../lib/config.js';",
      "export type { FeatureKey } from '../lib/types.js';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('names a document type the entry dropped', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '../lib/config.js';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names a document type the entry takes from somewhere other than config.ts', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '../lib/config.js';",
      "export type { ReloadResult } from '../lib/reload.js';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from ../lib/reload.js'],
      extra: [],
    });
  });

  it('names a config.ts type the entry publishes past the set', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '../lib/config.js';",
      "export type { Hidden } from '../lib/config.js';",
    );

    expect(parity).toEqual({ absent: [], extra: ['Hidden'] });
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
