import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { createTwoslasher } from 'twoslash';
import { describe, expect, it } from 'vitest';

import {
  DeclarationError,
  readReference,
} from '@evanion/doc-examples/declarations';
import type { ExportKind } from '@evanion/doc-examples/declarations';
import { expandReferences } from '@evanion/doc-examples/mdx-reference-loader';
import { authoredPages } from './docs-content';

/**
 * The reference loader, over the package the reference page is built on.
 *
 * Two halves, tested apart. `readReference` asks the compiler what an export
 * is, and it is checked against `@evanion/acl` because a fixture package whose
 * declarations somebody wrote by hand would prove that the reader agrees with
 * the fixture. `expandReferences` turns that answer into markdown, and it is
 * checked against a stub, because what the markdown says is a separate
 * question from where the facts came from.
 *
 * The reader resolves through the package's `dist/`, so this runs after the
 * libraries build. `nx.json`'s `test` target already orders `^build` first.
 */

const ACL = '@evanion/acl';

function read(_root: string, specifier: string, name: string) {
  return {
    name,
    specifier,
    kind: 'function' as ExportKind,
    signature: {
      text: 'function widen(value: string): number;',
      merges: true,
      values: ['widen'],
      types: ['Widened'],
      fromRoot: [],
      external: [] as [specifier: string, names: string[]][],
      prelude: [],
    },
    rootSpecifier: specifier,
    summary: 'Widens a value.',
    rest: 'The second paragraph.',
    tags: [{ name: 'param', text: 'value the thing to widen' }],
    declaration: '/nowhere/index.d.ts',
    examples: 'libs/acl/docs/examples.md',
  };
}

/** The stub, with one field answered differently. */
type Reader = typeof read;

function readAs(overrides: {
  external?: [specifier: string, names: string[]][];
  examples?: string;
  kind?: ExportKind;
}): Reader {
  return (root, specifier, name) => {
    const found = read(root, specifier, name);

    return {
      ...found,
      kind: overrides.kind ?? found.kind,
      examples: overrides.examples ?? found.examples,
      signature: {
        ...found.signature,
        external: overrides.external ?? found.signature.external,
      },
    };
  };
}

/** Every fence's info string in an expanded entry, in the order they appear. */
function fenceInfos(out: string): string[] {
  return out
    .split('\n')
    .filter((line) => line.startsWith('```'))
    .map((line) => line.slice(3))
    .filter(Boolean);
}

describe('reading an export off its declarations', () => {
  it('reads a function as a function, with its docblock split', () => {
    const found = readReference(workspaceRoot, ACL, 'hydratePolicy');

    expect(found.kind).toBe('function');
    expect(found.summary).toBe('The evaluator over a matrix document.');
    expect(
      found.rest,
      'The rest of the docblock is what the disclosure holds, and an entry ' +
        'that dropped it would be the truncation this design refused.',
    ).toContain('the compile-time surface');
  });

  it('gives a type alias its members rather than its own name', () => {
    const found = readReference(workspaceRoot, ACL, 'Reason');

    expect(found.kind).toBe('typeAlias');
    expect(
      found.signature?.text,
      'A Twoslash `^?` over an alias returns the resolved union and over an ' +
        'interface returns the name. Printing the declaration answers both.',
    ).toContain("'stale-contract'");
  });

  it('gives an interface its fields', () => {
    const found = readReference(workspaceRoot, ACL, 'Decision');

    expect(found.kind).toBe('interface');
    expect(found.signature?.text).toContain('allowed: boolean');
  });

  it('gives a class its constructor', () => {
    const found = readReference(workspaceRoot, ACL, 'InvalidConditionError');

    expect(found.kind).toBe('error');
    expect(
      found.signature?.text,
      'A reader asking what to pass `new InvalidConditionError(...)` gets ' +
        'the constructor, which is the question a property table cannot answer.',
    ).toContain('constructor(');
  });

  it('imports the names its declaration mentions, and no type parameter', () => {
    const found = readReference(workspaceRoot, ACL, 'hydratePolicy');
    const named = [
      ...(found.signature?.values ?? []),
      ...(found.signature?.types ?? []),
    ];

    expect(named).toContain('Matrix');
    expect(
      named,
      '`Sub` is a type parameter, not an export, so intersecting with the ' +
        'export list drops it without anything having to reason about it.',
    ).not.toContain('Sub');
  });

  it('imports a type the declaration file takes from another package', () => {
    const found = readReference(
      workspaceRoot,
      '@evanion/react-feature',
      'FeatureProviderProps',
    );

    expect(found.signature?.external).toEqual([['react', ['ReactNode']]]);
    expect(
      found.signature?.types,
      '`ReactNode` belongs to `react`, so importing it from the documented ' +
        'specifier would name an export the package does not have.',
    ).not.toContain('ReactNode');
  });

  it('prints a private type the declaration file imports from a sibling module', () => {
    const found = readReference(workspaceRoot, '@evanion/feature', 'Features');

    expect(
      found.signature?.prelude.some((each) =>
        each.startsWith('type VariantNames<'),
      ),
      '`features.d.ts` imports `VariantNames` from `./types.js`, and the ' +
        'package publishes it nowhere, so the fence declares it above the cut.',
    ).toBe(true);
  });

  it('keeps a name the entry publishes on the documented specifier', () => {
    const found = readReference(
      workspaceRoot,
      '@evanion/react-feature',
      'FeatureProviderProps',
    );

    expect(
      found.signature?.types,
      '`VersionMismatchPolicy` is declared in `src/hydrate.ts` and published ' +
        'by the entry, so the entry is where a reader imports it from. The ' +
        'external branch would name `./hydrate.js`, which resolves to nothing ' +
        'outside the package.',
    ).toContain('VersionMismatchPolicy');
    expect(
      (found.signature?.external ?? []).map(([specifier]) => specifier),
    ).not.toContain('./hydrate.js');
  });

  it('imports the external type of a second binding the same way', () => {
    const found = readReference(
      workspaceRoot,
      '@evanion/react-acl',
      'PolicyProviderProps',
    );

    expect(
      found.signature?.external,
      'The rule is about a declaration file importing from another package ' +
        'and not about one package. Every framework binding here imports its ' +
        "framework's types, so the second one answers whether the first was " +
        'a special case.',
    ).toEqual([['react', ['ReactNode']]]);
  });

  it('refuses a name the package does not export', () => {
    expect(() => readReference(workspaceRoot, ACL, 'noSuchExport')).toThrow(
      DeclarationError,
    );
  });

  it('refuses a package nothing installed', () => {
    expect(() => readReference(workspaceRoot, '@evanion/nope', 'x')).toThrow(
      DeclarationError,
    );
  });
});

describe('expanding a reference directive', () => {
  const page = 'apps/docs/content/next/acl/api.mdx';

  it('wraps the entry in the kind that colours its name', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      read,
    );

    expect(out).toContain(
      '<div className="docs-api-entry baize-kind-function">',
    );
    expect(out).toContain('<Chip>function</Chip>');
    expect(
      out,
      'The heading stays a markdown heading, which is what keeps its anchor, ' +
        'its place in the table of contents and its row in the search index.',
    ).toContain('## `widen`');
  });

  it('puts the first paragraph in the open and the rest behind a disclosure', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      read,
    );

    expect(out).toContain('Widens a value.');
    expect(out).toContain('<details className="docs-api-entry__more">');
    expect(out).toContain('The second paragraph.');
  });

  it('renders a block tag as prose, where the search index can reach it', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      read,
    );

    expect(
      out,
      'Every `<pre>` on this site carries `data-pagefind-ignore`, so a ' +
        'parameter named only inside the signature is a name no search finds.',
    ).toContain('`value` the thing to widen');
  });

  it('carries only the meta Nextra injects its Popup component for', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      read,
    );
    const infos = out
      .split('\n')
      .filter((line) => line.startsWith('```'))
      .map((line) => line.slice(3))
      .filter(Boolean);

    expect(
      infos,
      'Nextra matches the meta string exactly, and a fence carrying anything ' +
        'else blocks the import and throws on a `Popup` the page never got.',
    ).toEqual(['ts twoslash']);
  });

  it('imports an external type from the package the declaration took it from', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      readAs({ external: [['react', ['ReactNode']]] }),
    );

    expect(out).toContain("import type { ReactNode } from 'react';");
    expect(
      out,
      'Importing it from the documented specifier would name an export the ' +
        'package does not have, and the fence would fail the build.',
    ).not.toContain("import type { ReactNode } from '@evanion/acl';");
  });

  it('writes one import line per external package, with its names on it', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen -->\n',
      workspaceRoot,
      page,
      readAs({
        external: [
          ['react', ['ReactElement', 'ReactNode']],
          ['@evanion/feature', ['Features']],
        ],
      }),
    );
    const imports = out
      .split('\n')
      .filter((line) => line.startsWith('import type {'));

    expect(
      imports,
      'A prettier-wrapped multi-line import inside a fence fails with ' +
        '"Cannot use import statement outside a module", so each package ' +
        'gets one line and the names go on it.',
    ).toEqual([
      "import type { Widened } from '@evanion/acl';",
      "import type { ReactElement, ReactNode } from 'react';",
      "import type { Features } from '@evanion/feature';",
    ]);
  });

  it('refuses a directive with no heading above it', () => {
    expect(() =>
      expandReferences(
        'Some prose.\n\n<!-- reference @evanion/acl#widen -->\n',
        workspaceRoot,
        page,
        read,
      ),
    ).toThrow(/has no heading above it/);
  });

  it('gives an example fence the language its region was written in', () => {
    const tsRegion = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen example=first-policy -->\n',
      workspaceRoot,
      page,
      read,
    );
    const tsxRegion = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen example=react-provider -->\n',
      workspaceRoot,
      page,
      readAs({
        examples: 'libs/react-feature/docs/examples.md',
        kind: 'interface',
      }),
    );

    expect(
      fenceInfos(tsRegion),
      'The signature fence is always `ts`. The example fence is the ' +
        "region's own language.",
    ).toEqual(['ts twoslash', 'ts twoslash']);
    expect(
      fenceInfos(tsxRegion),
      'A `tsx` region compiled as `ts` reports every tag as an unterminated ' +
        'regular expression, so a React package would fail `next build` on ' +
        'the first entry carrying an example.',
    ).toEqual(['ts twoslash', 'tsx twoslash']);
  });

  it('writes the language once, whatever the region fence carried', () => {
    const out = expandReferences(
      '## `widen`\n\n<!-- reference @evanion/acl#widen example=react-provider -->\n',
      workspaceRoot,
      page,
      readAs({
        examples: 'libs/react-feature/docs/examples.md',
        kind: 'interface',
      }),
    );

    expect(
      fenceInfos(out).filter((info) => /twoslash.*twoslash/.test(info)),
      'Nextra matches the meta string exactly. A region whose own fence ' +
        'already carried the word would otherwise reach the page as ' +
        '`tsx twoslash twoslash` and block the import the page needs.',
    ).toEqual([]);
  });

  it('refuses a named region the README does not carry', () => {
    expect(() =>
      expandReferences(
        '## `widen`\n\n<!-- reference @evanion/acl#widen example=no-such-region -->\n',
        workspaceRoot,
        page,
        read,
      ),
    ).toThrow(/no-such-region/);
  });

  it('leaves a directive inside a fence alone', () => {
    const source = [
      '```md',
      '<!-- reference @evanion/acl#widen -->',
      '```',
      '',
    ].join('\n');

    expect(expandReferences(source, workspaceRoot, page, read)).toBe(source);
  });

  it('leaves a page with no directive byte for byte alone', () => {
    const source = '# Title\n\nProse.\n\n## `widen`\n\nMore prose.\n';

    expect(expandReferences(source, workspaceRoot, page, read)).toBe(source);
  });
});

/**
 * Every entry's signature fence answers for the package, not for itself.
 *
 * This is the guard for a defect that looked correct in a browser. A fence
 * carrying `export declare function hydratePolicy(...)` re-declares the symbol,
 * and Twoslash answers about what the fence declares, so hovering the name gave
 * a type and no prose while every hover still rendered and every fence still
 * compiled. The docblock lives in the source that was printed from, and a
 * printed copy leaves it behind.
 *
 * The count is the test. A documented hover on the entry's own name means the
 * identifier resolved to the published symbol; zero means the fence shadowed
 * it. Measured off the compiler rather than off the built HTML, because the
 * same nodes drive both and `next build` is slow and runs late.
 */
describe('a reference entry hovers the package', () => {
  const DIRECTIVE = /<!--\s*reference\s+(\S+)#(\w+)/g;
  const twoslasher = createTwoslasher();

  /**
   * The kinds TypeScript merges. A class, a `const` and a type alias cannot be
   * declared twice, so their fences print the declaration and their own name's
   * hover carries no prose; the entry renders that prose above the fence
   * either way. A printed type alias produces no hover on its own name at all.
   */
  const MERGING = new Set(['function', 'interface']);

  const referenced = authoredPages().flatMap((path) =>
    [...readFileSync(path, 'utf8').matchAll(DIRECTIVE)].map((match) => ({
      page: relative(workspaceRoot, path),
      specifier: match[1] as string,
      name: match[2] as string,
    })),
  );

  it('finds the entries', () => {
    expect(referenced.length).toBeGreaterThan(0);
  });

  /**
   * G5's heading rule, for a page that no longer has the fences it reads.
   *
   * `doc-exports.test.ts` holds a `##` heading to its package's export list by
   * iterating `signature` fences, and a converted page has none, so it covers
   * nothing here. The build covers it -- the loader throws on a name the
   * package does not export and `next build` fails -- but the build is slow
   * and runs late, and a guard that only exists in a build is a guard nobody
   * meets until CI. This is the same rule, in `nx test`, keyed on the
   * directive instead of the fence.
   */
  it('names an export the package really has', () => {
    const missing = referenced.flatMap((entry) => {
      try {
        readReference(workspaceRoot, entry.specifier, entry.name);
        return [];
      } catch (error) {
        return [`${entry.page}: ${(error as Error).message}`];
      }
    });

    expect(missing).toEqual([]);
  });

  it('documents the name every merging entry is about', () => {
    const undocumented = referenced.flatMap((entry) => {
      // Keyed on the kind and not on what the emission claims about itself,
      // so an emission that stops merging fails here rather than opting out.
      const found = readReference(workspaceRoot, entry.specifier, entry.name);
      if (!MERGING.has(found.kind)) return [];
      // An export with no docblock has no prose for a hover to carry, and
      // four of `@evanion/acl`'s do not have one. That is the library's to
      // fix and not the loader's, and `doc-export-coverage.test.ts` is where
      // an undocumented export is already somebody's problem.
      if (found.summary === '' && found.rest === '') return [];

      const out = expandReferences(
        `## \`${entry.name}\`\n\n<!-- reference ${entry.specifier}#${entry.name} -->\n`,
        workspaceRoot,
        entry.page,
      );
      const code = out
        .split('\n')
        .slice(out.split('\n').indexOf('```ts twoslash') + 1)
        .join('\n')
        .split('```')[0] as string;

      const documented = twoslasher(code, 'ts')
        .nodes.filter((node) => node.type === 'hover')
        .filter((node) => node.target === entry.name && node.docs);

      return documented.length > 0
        ? []
        : [`${entry.page}: ${entry.name} hovers its own name with no prose`];
    });

    expect(
      undocumented,
      'A signature fence that re-declares the export answers about itself, ' +
        'and a re-declared symbol has no docblock. Declaring it inside ' +
        "`declare module '<specifier>'` merges with the published symbol " +
        'instead, so the hover answers for the package.',
    ).toEqual([]);
  });

  it('keeps a merging kind merging', () => {
    const kinds = referenced.map(
      (entry) => readReference(workspaceRoot, entry.specifier, entry.name).kind,
    );

    for (const kind of new Set(kinds)) {
      const found = referenced.find(
        (entry) =>
          readReference(workspaceRoot, entry.specifier, entry.name).kind ===
          kind,
      );
      const signature = readReference(
        workspaceRoot,
        found?.specifier as string,
        found?.name as string,
      ).signature;

      expect(
        signature?.merges,
        `${kind} should ${MERGING.has(kind) ? '' : 'not '}merge. A kind that ` +
          `stops merging loses its docblock on hover and nothing else changes.`,
      ).toBe(MERGING.has(kind));
    }
  });
});
