import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { chainsOf } from '@evanion/doc-examples/behaviours';
import { expandReferences } from '@evanion/doc-examples/mdx-reference-loader';
import type { StatedFile } from '@evanion/doc-examples/mdx-reference-loader';

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

/** One rail row in the props the loader emits: its sentence and its case. */
const ROW = /\{"title":("(?:[^"\\]|\\.)*"),"id":(\d+)\}/g;

/** One package's cases, as `docs:behaviour-data` writes them beside the page. */
interface Sidecar {
  bodies: Record<string, { where: string; line: number; html: string }>;
  styles: Record<string, string>;
}

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

    expect(found).toMatchObject([
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

  it('carries the case body, with the nesting taken off the front', () => {
    const [found] = chainsOf(
      source(
        `describe('widen', () => {
           describe('a narrowing', () => {
             it('refuses a key the document never held', () => {
               const out = widen(matrix, {});
               expect(out).toBe(null);
             });
           });
         });`,
      ),
    );

    expect(
      found?.body,
      'The pane shows the assertions the author wrote and never a reading of ' +
        'them, and it shows them at column zero however deep the case sits.',
    ).toBe('const out = widen(matrix, {});\nexpect(out).toBe(null);');
    expect(found?.line).toBe(3);
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

    expect(found).toMatchObject([
      {
        chain: ['widen', 'an overlay that matches nothing changes no decision'],
        generated: true,
      },
    ]);
    expect(
      found[0]?.body,
      'A seeded case has no sentence of its own, so what it asserts is the ' +
        'whole call, seeds included.',
    ).toContain('it.each([1, 2])');
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
    ).toContain('"canFields decides a proposed key the object does not carry"');
  });

  it('gives a condition the suite wrote its own group in the rail', () => {
    const out = expand('hydratePolicy');

    expect(out).toContain('{"label":"version"');
    expect(
      out,
      'The condition names itself once, as the label over the sentences that ' +
        'hold under it, rather than on the front of each of them.',
    ).toContain('"comes from the options when the document states none"');
  });

  it('labels the sentences under the export itself with the export name', () => {
    expect(
      expand('diffMatrix'),
      "They sit under the export's own `describe` and nothing else, so an " +
        'unlabelled run of them beside the labelled groups read as belonging ' +
        'to nowhere.',
    ).toContain('{"label":"diffMatrix"');
  });

  it('gives every sentence the number its case is keyed by', () => {
    const rows = [...expand('hydratePolicy').matchAll(ROW)];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Number.isInteger(Number(row[2]))).toBe(true);
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
    const shown = [...out.matchAll(ROW)].length;
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
    ).not.toMatch(/passed|\u2713|\u2717/);
  });

  it('names the library whose sidecar carries the cases', () => {
    expect(expand('hydratePolicy')).toContain(
      '<BehaviourCatalogue library="acl"',
    );
  });
});

/**
 * The cases behind the sentences, held against the sentences.
 *
 * The two files are written by one run of `docs:behaviour-data` and read by
 * two different readers: the loader takes the index during `next build` and the
 * catalogue fetches the sidecar in a browser. A sentence whose number the
 * sidecar has no body for renders a rail row that opens onto nothing, and
 * nothing else in the build would say so.
 */
describe('the cases a catalogue opens', () => {
  const index = join(workspaceRoot, 'apps/docs/components/api/behaviour');
  const sidecars = join(workspaceRoot, 'apps/docs/public/behaviour');

  const libraries = (): string[] => {
    try {
      return readdirSync(index).filter((name) => name.endsWith('.json'));
    } catch {
      throw new Error(
        `${index} does not exist. Run \`npx nx run docs:behaviour-data\`.`,
      );
    }
  };

  const read = <T>(directory: string, name: string): T =>
    JSON.parse(readFileSync(join(directory, name), 'utf8')) as T;

  it('writes a sidecar for every library that states something', () => {
    expect(libraries().length).toBeGreaterThan(0);
    expect(readdirSync(sidecars).sort()).toEqual(libraries().sort());
  });

  it.each(libraries())('carries a case for every sentence of %s', (name) => {
    const stated = read<StatedFile>(index, name);
    const sidecar = read<Sidecar>(sidecars, name);
    const missing = new Set<number>();

    for (const held of Object.values(stated.states)) {
      for (const each of held) {
        if (!(String(each.id) in sidecar.bodies)) missing.add(each.id);
      }
    }

    expect([...missing]).toEqual([]);
  });

  it.each(libraries())('highlights every case of %s', (name) => {
    const sidecar = read<Sidecar>(sidecars, name);
    const bodies = Object.values(sidecar.bodies);

    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.where).toMatch(/^libs\//);
      expect(body.line).toBeGreaterThan(0);
      expect(body.html.length).toBeGreaterThan(0);
    }
  });

  it('gives every token a class the sidecar defines', () => {
    for (const name of libraries()) {
      const sidecar = read<Sidecar>(sidecars, name);
      const used = new Set<string>();

      for (const body of Object.values(sidecar.bodies)) {
        for (const [, token] of body.html.matchAll(/class="(bh\d+)"/g)) {
          if (token !== undefined) used.add(token);
        }
      }

      expect([...used].filter((token) => !(token in sidecar.styles))).toEqual(
        [],
      );
    }
  });
});
