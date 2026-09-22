import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { createTwoslasher } from 'twoslash';
import { describe, expect, it } from 'vitest';

import {
  DeclarationError,
  readReference,
} from '@evanion/doc-examples/declarations';
import { expandReferences } from '@evanion/doc-examples/mdx-reference-loader';

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
    kind: 'function' as const,
    signature: {
      text: 'function widen(value: string): number;',
      merges: true,
      values: ['widen'],
      types: ['Widened'],
    },
    summary: 'Widens a value.',
    rest: 'The second paragraph.',
    tags: [{ name: 'param', text: 'value the thing to widen' }],
    declaration: '/nowhere/index.d.ts',
    readme: 'libs/acl/README.md',
  };
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
  const page = 'apps/docs/content/acl/api.mdx';

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
  const CONTENT = join(workspaceRoot, 'apps/docs/content');
  const DIRECTIVE = /<!--\s*reference\s+(\S+)#(\w+)/g;
  const twoslasher = createTwoslasher();

  /**
   * The kinds TypeScript merges. A class, a `const` and a type alias cannot be
   * declared twice, so their fences print the declaration and their own name's
   * hover carries no prose; the entry renders that prose above the fence
   * either way. A printed type alias produces no hover on its own name at all.
   */
  const MERGING = new Set(['function', 'interface']);

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name.endsWith('.mdx') ? [path] : [];
    });
  }

  const referenced = pages(CONTENT).flatMap((path) =>
    [...readFileSync(path, 'utf8').matchAll(DIRECTIVE)].map((match) => ({
      page: relative(workspaceRoot, path),
      specifier: match[1] as string,
      name: match[2] as string,
    })),
  );

  it('finds the entries', () => {
    expect(referenced.length).toBeGreaterThan(0);
  });

  it('documents the name every merging entry is about', () => {
    const undocumented = referenced.flatMap((entry) => {
      // Keyed on the kind and not on what the emission claims about itself,
      // so an emission that stops merging fails here rather than opting out.
      const found = readReference(workspaceRoot, entry.specifier, entry.name);
      if (!MERGING.has(found.kind)) return [];

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
