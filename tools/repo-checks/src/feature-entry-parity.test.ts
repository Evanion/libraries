import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * `@evanion/react-feature` re-exports the document types `@evanion/feature`
 * publishes, by name.
 *
 * Nothing at runtime holds this half of the react entry's claim, because a
 * type-only re-export erases, so it is read off the sources. The rule is parity
 * with the core entry: every document type `libs/feature/src/index.ts`
 * publishes from `libs/feature/src/lib/config.ts` is on
 * `libs/react-feature/src/index.tsx`, from `@evanion/feature`, and the react
 * entry publishes no `config.ts` type the core keeps to itself. A name added to
 * one entry and forgotten on the other fails here.
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
 * The clause reader takes the type-only ones. A value the entry re-exports is
 * `libs/react-feature/src/entry-surface.spec.tsx`'s business, which reads the
 * module namespace a bundler builds, and the names cases below say nothing
 * about it.
 *
 * `libs/react-feature/src/config-types.test-d.tsx` holds the third half: each
 * name on the react entry is the core entry's declaration and not a
 * redeclaration beside it.
 */

const CORE_ENTRY = join(workspaceRoot, 'libs/feature/src/index.ts');
const REACT_ENTRY = join(workspaceRoot, 'libs/react-feature/src/index.tsx');
const CONFIG = join(workspaceRoot, 'libs/feature/src/lib/config.ts');

/** The module the document types resolve as, from each entry. */
const CORE_CONFIG_SPECIFIER = './lib/config.js';
const REACT_CONFIG_SPECIFIER = '@evanion/feature';

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
 * mark re-exports a value, which no case here has an opinion about:
 * `entry-surface.spec.tsx` reads those names off the module namespace.
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
 * `absent` is scoped to `specifier`, the module the document types resolve as
 * from that entry. A name the entry takes from any other module leaves a
 * published name `absent`, because the name a component file imports has to be
 * the core's declaration and not a second one beside it.
 *
 * `extra` is scoped to `vocabulary`, the set `config.ts` declares. The react
 * entry re-exports the document types and the decision-set types from one
 * specifier, `@evanion/feature`, so the specifier does not tell a document
 * type from anything else the core publishes. `DecisionSet` and
 * `DivergenceReport` are declared elsewhere and this rule has no opinion about
 * them; a `config.ts` type the core keeps to itself is what it reports.
 */
function parityWith(
  entry: ts.SourceFile,
  specifier: string,
  published: readonly string[],
  vocabulary: readonly string[],
): Parity {
  const named = typeReExports(entry);
  const absent = published
    .filter((name) => named.get(name) !== specifier)
    .map((name) => `${name} from ${named.get(name) ?? 'nowhere'}`)
    .sort();
  const extra = [...named]
    .filter(
      ([name, from]) =>
        from === specifier &&
        vocabulary.includes(name) &&
        !published.includes(name),
    )
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

describe('the names the react entry re-exports', () => {
  it('publishes what the core entry publishes, each one from config.ts itself', () => {
    const parity = parityWith(
      read(REACT_ENTRY),
      REACT_CONFIG_SPECIFIER,
      CORE_DOCUMENT_TYPES,
      DOCUMENT_TYPES,
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('is held to a real set, because the core publishes the eight the spec names', () => {
    const missing = SPEC_DOCUMENT_TYPES.filter(
      (name) => !CORE_DOCUMENT_TYPES.includes(name),
    );

    expect(missing).toEqual([]);
  });

  it('holds the extra check to a vocabulary that carries every core name', () => {
    const undeclared = CORE_DOCUMENT_TYPES.filter(
      (name) => !DOCUMENT_TYPES.includes(name),
    );

    expect(undeclared).toEqual([]);
  });
});

describe('the parity rule', () => {
  const PUBLISHED = ['FeatureConfig', 'ReloadResult'];
  /** What `config.ts` declares, for a fixture: the set plus one it keeps. */
  const VOCABULARY = [...PUBLISHED, 'Hidden'];

  function verdict(...clauses: readonly string[]): Parity {
    return parityWith(
      parse('entry.tsx', clauses.join('\n')),
      REACT_CONFIG_SPECIFIER,
      PUBLISHED,
      VOCABULARY,
    );
  }

  it('takes an entry publishing the core names from config.ts', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '@evanion/feature';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('takes a type the entry publishes from a module config.ts is not', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '@evanion/feature';",
      "export type { FeatureKey } from '../lib/types.js';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('names a document type the entry dropped', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '@evanion/feature';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names a document type the entry takes from somewhere other than config.ts', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '@evanion/feature';",
      "export type { ReloadResult } from '../lib/reload.js';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from ../lib/reload.js'],
      extra: [],
    });
  });

  it('names a config.ts type the entry publishes past the set', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '@evanion/feature';",
      "export type { Hidden } from '@evanion/feature';",
    );

    expect(parity).toEqual({ absent: [], extra: ['Hidden'] });
  });

  it('takes the document types inside a mixed clause beside a value', () => {
    const parity = verdict(
      "export { type FeatureConfig, FeatureProvider, type ReloadResult } from '@evanion/feature';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('takes a core type config.ts does not declare from the same specifier', () => {
    const parity = verdict(
      "export type { DecisionSet, FeatureConfig, ReloadResult } from '@evanion/feature';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });

  it('names every document type an entry re-exports as a value', () => {
    const parity = verdict(
      "export { FeatureConfig, ReloadResult } from '@evanion/feature';",
    );

    expect(parity).toEqual({
      absent: ['FeatureConfig from nowhere', 'ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names the whole set when the entry re-exports with a star', () => {
    const parity = verdict("export type * from '@evanion/feature';");

    expect(parity).toEqual({
      absent: ['FeatureConfig from nowhere', 'ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names a document type the entry declares itself', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '@evanion/feature';",
      'export type ReloadResult = { readonly changed: readonly string[] };',
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names a document type the entry publishes under another name', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult as Reloaded } from '@evanion/feature';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from nowhere'],
      extra: [],
    });
  });

  it('names a document type the entry takes through a relative path into the core', () => {
    const parity = verdict(
      "export type { FeatureConfig } from '@evanion/feature';",
      "export type { ReloadResult } from '../../feature/src/lib/config.js';",
    );

    expect(parity).toEqual({
      absent: ['ReloadResult from ../../feature/src/lib/config.js'],
      extra: [],
    });
  });

  it('names nothing extra when the entry publishes the kept type from another module', () => {
    const parity = verdict(
      "export type { FeatureConfig, ReloadResult } from '@evanion/feature';",
      "export type { Hidden } from './hidden.js';",
    );

    expect(parity).toEqual({ absent: [], extra: [] });
  });
});

describe('the declaration reader', () => {
  function declared(text: string): string[] {
    return declaredTypes(parse('config.ts', text));
  }

  it('reads exported interfaces and type aliases, sorted', () => {
    expect(
      declared(
        [
          'export type Zeta = string;',
          'export interface Alpha { readonly a: number }',
          'export type Mid<T extends string = string> = { readonly t: T };',
        ].join('\n'),
      ),
    ).toEqual(['Alpha', 'Mid', 'Zeta']);
  });

  it('leaves out a type the file declares without export', () => {
    expect(
      declared(
        [
          'type Kept = string;',
          'interface AlsoKept { readonly a: number }',
          'export type Public = Kept;',
        ].join('\n'),
      ),
    ).toEqual(['Public']);
  });

  it('leaves out exported values, classes and enums', () => {
    expect(
      declared(
        [
          'export const LIMIT = 1;',
          'export function parse(): void {}',
          'export class Store {}',
          'export enum Mode { A }',
          'export type Shape = { readonly mode: Mode };',
        ].join('\n'),
      ),
    ).toEqual(['Shape']);
  });

  it('leaves out a type the file publishes through a clause and not on its declaration', () => {
    expect(
      declared(['type Listed = string;', 'export type { Listed };'].join('\n')),
    ).toEqual([]);
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

  it('records the name an aliased element publishes', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        "export type { Internal as FeatureConfig } from '../lib/config.js';",
      ),
    );

    expect([...named]).toEqual([['FeatureConfig', '../lib/config.js']]);
  });

  it('leaves out a clause with no module specifier', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        ['type FeatureConfig = string;', 'export type { FeatureConfig };'].join(
          '\n',
        ),
      ),
    );

    expect([...named]).toEqual([]);
  });

  it('leaves out star and namespace re-exports, which carry no names', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        [
          "export type * from '../lib/config.js';",
          "export * from '../lib/config.js';",
          "export * as config from '../lib/config.js';",
          "export type * as types from '../lib/config.js';",
        ].join('\n'),
      ),
    );

    expect([...named]).toEqual([]);
  });

  it('reads a clause that spans lines and carries comments', () => {
    const named = typeReExports(
      parse(
        'entry.tsx',
        [
          'export type {',
          '  // the document',
          '  FeatureConfig,',
          '  /** the reload */ ReloadResult,',
          "} from '@evanion/feature';",
        ].join('\n'),
      ),
    );

    expect([...named]).toEqual([
      ['FeatureConfig', '@evanion/feature'],
      ['ReloadResult', '@evanion/feature'],
    ]);
  });
});
