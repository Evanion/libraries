import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

import { resolveAlias } from '@evanion/doc-examples/declarations';
import { entriesOf, packages, type Entry } from './released-exports';

/**
 * An entry point re-exports every sibling package's type its own declarations
 * name.
 *
 * `@evanion/react-feature` declares
 * `FeatureProviderProps.features: Features<S, Frozen>`, and `Features` is
 * `@evanion/feature`'s. A consumer who annotates that prop reaches one
 * specifier for the prop and a second for the type inside it, and the second
 * one is a package their application need not depend on directly: a framework
 * binding carries the core as a dependency, so `npm install
 * @evanion/react-feature` alone leaves `import type { Features } from
 * '@evanion/feature'` an undeclared import in their own source.
 *
 * The documentation loader makes the same reading. `declarationOf` in
 * `tools/doc-examples/src/declarations.mjs` imports a name from the documented
 * specifier when that entry exports it and from wherever the declaration file
 * took it otherwise, so a type the entry withholds renders a reference entry
 * whose fence imports two packages to say one thing. That fence still
 * compiles, which is why nothing failed on it before.
 *
 * Scoped to the sibling packages this repository releases. A type from `react`
 * or from a library file belongs to somebody else and is nameable wherever
 * that package is installed, which a peer dependency already states.
 *
 * Read through the checker rather than off the import clauses, so an alias, a
 * barrel hop and a type reached through a re-exported function's signature all
 * report the same way.
 *
 * `adapter-type-reexport-allowance.json` is the ratchet, on the mechanism
 * `doc-control-allowance.json` and `doc-fence-allowance.json` carry. A
 * published declaration may name a sibling type the entry withholds on
 * purpose, and the entry records which hole and the argument for it. The key
 * is the hole the refusal names, the value is that argument, and a key the
 * walk no longer finds is itself a failure, so a clause that lands takes its
 * entry with it.
 */

const ALLOWANCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'adapter-type-reexport-allowance.json',
);

/** The holes this repository withholds on purpose, each with its argument. */
const allowance = JSON.parse(readFileSync(ALLOWANCE, 'utf8')) as Record<
  string,
  string
>;

/** One withheld sibling type: the hole the refusal names, and the refusal. */
interface Hole {
  /** `<specifier>: <exported> names <Type> from <owner>`. An allowance key. */
  key: string;
  message: string;
}

/** A released package's tree, keyed by the specifier that publishes it. */
interface Released {
  specifier: string;
  root: string;
}

/**
 * Each package's root, read off its own entry source.
 *
 * `<root>/src/index.ts` is the layout every library here publishes, and
 * `project-folder-name.test.ts` holds the directory to the package name, so
 * two segments up from the entry is the tree the package owns.
 */
function releasedRoots(entries: readonly Entry[]): Released[] {
  const roots = new Map<string, string>();

  for (const entry of entries) {
    if (entry.specifier !== entry.package) continue;
    roots.set(entry.package, join(entry.source, '..', '..'));
  }

  return [...roots].map(([specifier, root]) => ({ specifier, root }));
}

/** The released package a declaration file belongs to, or `null`. */
function ownerOf(file: string, released: readonly Released[]): string | null {
  const found = released.find((each) => file.startsWith(`${each.root}/`));

  return found ? found.specifier : null;
}

/**
 * Every type reference inside a published declaration.
 *
 * A function body is not published, so a type named only inside one stays
 * private. A private class member's type never reaches the emitted declaration
 * either, which is the rule `exported-type-closure.test.ts` applies for the
 * same reason.
 */
function typeReferences(declaration: ts.Node): ts.Identifier[] {
  const found: ts.Identifier[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isBlock(node)) return;
    if (
      (ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node)) &&
      ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Private
    ) {
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      found.push(
        ts.isQualifiedName(node.typeName) ? node.typeName.right : node.typeName,
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(declaration);

  return found;
}

/** One program over every entry at once, with `@evanion/*` mapped to source. */
function programOf(entries: readonly Entry[]): ts.Program {
  const paths: Record<string, string[]> = {};
  for (const entry of entries) {
    if (entry.specifier === entry.package)
      paths[entry.package] = [entry.source];
  }

  return ts.createProgram(
    entries.map((entry) => entry.source),
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      noEmit: true,
      paths,
    },
  );
}

/** Every sibling type a published declaration names and its entry withholds. */
function holes(entries: readonly Entry[]): Hole[] {
  const released = releasedRoots(entries);
  const program = programOf(entries);
  const checker = program.getTypeChecker();
  const found: Hole[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const source = program.getSourceFile(entry.source);
    if (!source) throw new Error(`${entry.source} is not in the program`);
    const module_ = checker.getSymbolAtLocation(source);
    if (!module_) throw new Error(`${entry.specifier} exports nothing`);

    const published = checker.getExportsOfModule(module_);
    const republished = new Set(
      published.map((each) => resolveAlias(each, checker)),
    );

    for (const exported of published) {
      for (const declaration of resolveAlias(
        exported,
        checker,
      ).getDeclarations() ?? []) {
        // Only what this package declares. A name it re-exports is somebody
        // else's declaration, and the types that declaration names are that
        // package's to publish: `Decision` comes off `@evanion/feature` and
        // names `Reason`, which the core publishes and which a consumer
        // annotating `Decision` reaches from the core, where `Decision` is.
        const declared = ownerOf(
          declaration.getSourceFile().fileName,
          released,
        );
        if (declared !== entry.package) continue;

        for (const name of typeReferences(declaration)) {
          const referenced = checker.getSymbolAtLocation(name);
          if (!referenced) continue;
          const target = resolveAlias(referenced, checker);

          for (const site of target.getDeclarations() ?? []) {
            if (ts.isTypeParameterDeclaration(site)) continue;
            const owner = ownerOf(site.getSourceFile().fileName, released);
            if (owner === null || owner === entry.package) continue;
            if (republished.has(target)) continue;

            const key = `${entry.specifier}: ${exported.getName()} names ${name.text} from ${owner}`;
            if (seen.has(key)) continue;
            seen.add(key);
            found.push({
              key,
              message:
                `${key}, and ${entry.specifier} re-exports no such name. A ` +
                `consumer annotating that declaration has to import a second ` +
                `package to write the annotation.`,
            });
          }
        }
      }
    }
  }

  return found.sort((left, right) => (left.key < right.key ? -1 : 1));
}

/** The holes `allowed` does not account for, as the refusal states them. */
function unallowed(
  found: readonly Hole[],
  allowed: Record<string, string>,
): string[] {
  return found
    .filter((hole) => !(hole.key in allowed))
    .map((hole) => hole.message)
    .sort();
}

/** The keys of `allowed` the walk no longer finds. */
function stale(
  found: readonly Hole[],
  allowed: Record<string, string>,
): string[] {
  const open = new Set(found.map((hole) => hole.key));

  return Object.keys(allowed)
    .filter((key) => !open.has(key))
    .sort();
}

describe('an entry point that names a sibling package type', () => {
  it('re-exports every one the allowance does not account for', async () => {
    const entries = (await packages()).flatMap(entriesOf);

    expect(
      unallowed(holes(entries), allowance),
      "Add the name to the entry point's own `export type` clause, or " +
        'record the hole and the argument for it in ' +
        'adapter-type-reexport-allowance.json.',
    ).toEqual([]);
  });

  it('records no allowance entry the walk no longer finds', async () => {
    const entries = (await packages()).flatMap(entriesOf);

    expect(
      stale(holes(entries), allowance),
      'These are recorded in adapter-type-reexport-allowance.json and the ' +
        'entry point now re-exports the name. Remove the entry.',
    ).toEqual([]);
  });

  it('gives an argument with every allowance entry', () => {
    expect(
      Object.entries(allowance)
        .filter(([, reason]) => reason.trim() === '')
        .map(([key]) => key),
      'An allowance is the argument for withholding a name, written for the ' +
        'reviewer who asks why. An empty one records nothing.',
    ).toEqual([]);
  });

  it('is a rule at least one released binding is under', async () => {
    const entries = (await packages()).flatMap(entriesOf);

    expect(
      entries.map((entry) => entry.specifier),
      'The rule is about one package naming another, so a walk that found ' +
        'neither a binding nor the core it binds proves nothing by passing.',
    ).toEqual(
      expect.arrayContaining(['@evanion/react-feature', '@evanion/feature']),
    );
  });
});

/**
 * The rule reports what it claims to, on a pair written for the case.
 *
 * Two packages on disk rather than a real pair: the repository's own packages
 * satisfy the rule, so nothing in `libs/` can show the failure this check
 * exists for. The binding names the core's type in a published interface and
 * re-exports one of the two it names, which is the half-done state a task that
 * adds a prop and forgets the clause leaves behind.
 */
describe('the rule, over a pair written to break it', () => {
  const written: string[] = [];

  afterAll(() => {
    for (const root of written) rmSync(root, { recursive: true, force: true });
  });

  function pair(bindingEntry: string): Entry[] {
    const root = mkdtempSync(join(tmpdir(), 'adapter-reexport-'));
    written.push(root);

    for (const [name, text] of [
      [
        'core',
        'export interface Store { on: boolean }\n' +
          'export interface Clock { now: Date }\n',
      ],
      ['binding', bindingEntry],
    ] as const) {
      mkdirSync(join(root, name, 'src'), { recursive: true });
      writeFileSync(join(root, name, 'src', 'index.ts'), text, 'utf8');
    }

    return ['core', 'binding'].map((name) => ({
      package: `@fixture/${name}`,
      slug: name,
      specifier: `@fixture/${name}`,
      source: join(root, name, 'src', 'index.ts'),
    }));
  }

  const WITHHOLDS =
    "import type { Clock, Store } from '@fixture/core';\n" +
    "export type { Store } from '@fixture/core';\n" +
    'export interface Props { store: Store; clock: Clock }\n';

  it('names the withheld type, the declaration and the package it came from', () => {
    const reported = unallowed(holes(pair(WITHHOLDS)), {});

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('@fixture/binding: Props names Clock');
    expect(reported[0]).toContain('from @fixture/core');
  });

  it('says nothing about the one the binding did re-export', () => {
    expect(unallowed(holes(pair(WITHHOLDS)), {}).join('\n')).not.toContain(
      'Store',
    );
  });

  it('passes once the withheld type joins the clause', () => {
    expect(
      unallowed(
        holes(
          pair(
            "import type { Clock, Store } from '@fixture/core';\n" +
              "export type { Clock, Store } from '@fixture/core';\n" +
              'export interface Props { store: Store; clock: Clock }\n',
          ),
        ),
        {},
      ),
    ).toEqual([]);
  });

  it('says nothing about a hole the allowance accounts for', () => {
    const found = holes(pair(WITHHOLDS));
    const allowed = {
      '@fixture/binding: Props names Clock from @fixture/core':
        'The fixture withholds it, and this entry is what proves a recorded ' +
        'hole goes unreported.',
    };

    expect(unallowed(found, allowed)).toEqual([]);
    expect(stale(found, allowed)).toEqual([]);
  });

  it('reports an allowance entry the walk no longer finds', () => {
    const closed = holes(
      pair(
        "import type { Clock, Store } from '@fixture/core';\n" +
          "export type { Clock, Store } from '@fixture/core';\n" +
          'export interface Props { store: Store; clock: Clock }\n',
      ),
    );

    expect(
      stale(closed, {
        '@fixture/binding: Props names Clock from @fixture/core': 'landed',
      }),
    ).toEqual(['@fixture/binding: Props names Clock from @fixture/core']);
  });

  it('says nothing about a sibling type named only inside a body', () => {
    expect(
      unallowed(
        holes(
          pair(
            "import type { Clock } from '@fixture/core';\n" +
              'export function at(): string {\n' +
              '  const clock: Clock = { now: new Date() };\n' +
              '  return clock.now.toISOString();\n' +
              '}\n',
          ),
        ),
        {},
      ),
      'A body is not published, so a type named only there is nameable by ' +
        'nobody and withholding it costs a consumer nothing.',
    ).toEqual([]);
  });

  it('says nothing about a type the binding declares itself', () => {
    expect(
      unallowed(
        holes(
          pair(
            'export interface Clock { now: Date }\n' +
              'export interface Props { clock: Clock }\n',
          ),
        ),
        {},
      ),
    ).toEqual([]);
  });
});
