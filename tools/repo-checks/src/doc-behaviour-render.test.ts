import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { chainsOf } from '@evanion/doc-examples/behaviours';
import { expandReferences } from '@evanion/doc-examples/mdx-reference-loader';

/**
 * The two halves of the behaviour catalogue, read apart.
 *
 * `chainsOf` decides which sentence a case contributes, and it is driven from a
 * source written here rather than from a library's suite, because what a runner
 * does with `describe.each` and a skipped case is the thing under test and a
 * real suite carries one shape of each at best.
 *
 * `expandReferences` decides what the entry says, and it is driven against
 * `@evanion/acl`'s own data, because the sentence a reader sees is the sentence
 * the package's tests carry and a hand-written fixture would prove that the
 * renderer agrees with the fixture.
 */

/** A test source, written where the parser can read it as a file. */
function source(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'behaviours-')), 'a.test.ts');
  writeFileSync(path, contents);
  return path;
}

const ACL = '@evanion/acl';

/** The stub `readReference` the rendering half is driven with. */
function read(_root: string, specifier: string, name: string) {
  return {
    name,
    specifier,
    kind: 'function' as const,
    signature: {
      text: `function ${name}(value: string): number;`,
      merges: false,
      values: [name],
      types: [],
      fromRoot: [],
      prelude: [],
    },
    rootSpecifier: specifier,
    summary: 'Widens a value.',
    rest: '',
    tags: [],
    declaration: '/nowhere/index.d.ts',
    readme: 'libs/acl/README.md',
  };
}

const page = 'apps/docs/content/acl/api.mdx';

const expand = (name: string): string =>
  expandReferences(
    `## \`${name}\`\n\n<!-- reference ${ACL}#${name} -->\n`,
    workspaceRoot,
    page,
    read,
  );

describe('chainsOf', () => {
  it('carries every `describe` above a case, outermost first', () => {
    const found = chainsOf(
      source(
        `describe('widen', () => {
           describe('a narrowing', () => {
             it('refuses a key the document never held', () => {});
           });
         });`,
      ),
    );

    expect(found).toEqual([
      {
        chain: [
          'widen',
          'a narrowing',
          'refuses a key the document never held',
        ],
        generated: false,
      },
    ]);
  });

  it('collapses a seeded case into the block that names what it is about', () => {
    const found = chainsOf(
      source(
        `describe('widen', () => {
           describe('an overlay that matches nothing changes no decision', () => {
             it.each([1, 2])('seed %i', () => {});
           });
         });`,
      ),
    );

    expect(found).toEqual([
      {
        chain: ['widen', 'an overlay that matches nothing changes no decision'],
        generated: true,
      },
    ]);
  });

  it('drops a block whose own title is written per row', () => {
    const found = chainsOf(
      source(
        `describe.each(['a', 'b'])('over the %s instance', () => {
           it('reaches every index', () => {});
         });`,
      ),
    );

    expect(
      found,
      'The runner reports `over the a instance`, so the title in the source ' +
        'is a format string no case ever ran under.',
    ).toEqual([]);
  });

  it('drops a case the runner never reaches', () => {
    const found = chainsOf(
      source(
        `describe('widen', () => {
           it.skip('refuses a key the document never held', () => {});
           it.todo('names the key');
         });`,
      ),
    );

    expect(found).toEqual([]);
  });
});

describe('the block an entry carries', () => {
  it('states the sentences under the export, with its own name dropped', () => {
    const out = expand('hydratePolicy');

    expect(out).toContain('What the tests state');
    expect(
      out,
      'The reader is on `hydratePolicy`, so the segment naming it is the one ' +
        'thing on the line they already have.',
    ).toContain('- canFields decides a proposed key the object does not carry');
  });

  it('gives a condition the suite wrote its own sentences', () => {
    const out = expand('hydratePolicy');

    expect(out).toContain(
      '<p className="docs-api-entry__states-condition">version</p>',
    );
    expect(
      out,
      'The condition names itself once, above the sentences that hold under ' +
        'it, rather than on the front of each of them.',
    ).toContain('- comes from the options when the document states none');
  });

  it('says so where a callable export has nothing stated', () => {
    expect(expand('noSuchExport')).toContain(
      'No test in this package states a behaviour under this name.',
    );
  });

  it('puts the sentences between the signature and the example', () => {
    const out = expand('hydratePolicy');

    expect(out.indexOf('docs-api-entry__states')).toBeGreaterThan(
      out.indexOf('docs-api-entry__signature'),
    );
  });

  it('counts the sentences it shows and nothing beyond them', () => {
    const out = expand('hydratePolicy');
    const shown = out.match(/^- /gm)?.length ?? 0;
    const counted = /<Figure>(\d+)<\/Figure> behaviours/.exec(out);

    expect(counted?.[1]).toBe(String(shown));
    expect(
      out,
      "The `/testing` section holds the suite's totals, so the entry says " +
        'how many sentences it carries and never how many cases ran.',
    ).not.toMatch(/\d+ (cases|tests)/);
  });

  it('carries no status beside a sentence', () => {
    expect(
      expand('hydratePolicy'),
      'Every sentence here comes from a suite that passes, so a tick states ' +
        'nothing, and a green one states that the page verified something.',
    ).not.toMatch(/passed|✓|✗/);
  });
});
