import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

/**
 * G6 of `docs/specs/2026-09-16-documentation-standard.md` § 12: every landing
 * specimen is reachable from a section.
 *
 * A component under `apps/docs/components/landing/` that a reader can operate
 * is registered in `mdx-components.js` and mounted on at least one page of
 * `content/`. That is decision 20: the front page is the only entry point that
 * is not a section, so a control reachable from it alone is reachable from one
 * place, and the reader who follows the tile into the section never sees it
 * again. The rule is the same component in both places.
 *
 * There is no allowance in this guard and no exemption for a section that
 * already carries a probe. § 9 is explicit that a probe is a different and
 * smaller thing than the card, so a probe does not discharge a specimen.
 *
 * What it reaches is that the component is registered and that a page names it.
 * Whether the prose around it teaches is § 12's reviewer list.
 */

const DOCS = join(workspaceRoot, 'apps/docs');
const LANDING = join(DOCS, 'components', 'landing');
const CONTENT = join(DOCS, 'content');
const MAP = join(DOCS, 'mdx-components.js');

/**
 * The landing components a reader can operate.
 *
 * Two marks together, because either alone is wrong. `'use client'` as the
 * file's first statement is what React requires of a component that holds
 * state, and a default export is what a JSX tag resolves to. The directive has
 * to be the opening line rather than anywhere in the file: `counter.tsx`
 * explains in a docblock that it carries none, and a substring search reads
 * that sentence as the directive.
 */
function specimens(): string[] {
  return readdirSync(LANDING)
    .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    .filter((name) => {
      const source = readFileSync(join(LANDING, name), 'utf8');
      return (
        /^\s*(['"])use client\1;?/.test(source) &&
        /^export default function /m.test(source)
      );
    })
    .map((name) => name.replace(/\.tsx$/, ''))
    .sort();
}

/** The names `mdx-components.js` puts on the map an `.mdx` page compiles against. */
function registered(): string[] {
  const source = readFileSync(MAP, 'utf8');
  const body = source.slice(source.indexOf('return {'));

  return [...body.matchAll(/^\s{4}(\w+),$/gm)].map(
    ([, name]) => name as string,
  );
}

/** Every `.mdx` and `.md` page under `content/`, as one string per page. */
function pages(): string[] {
  const out: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.mdx?$/.test(entry.name)) out.push(readFileSync(path, 'utf8'));
    }
  }

  walk(CONTENT);
  return out;
}

describe('the landing specimens', () => {
  it('finds the components a reader can operate', () => {
    expect(specimens().length).toBeGreaterThan(0);
  });

  it('registers each one in the map an mdx page compiles against', () => {
    const map = registered();

    expect(
      specimens().filter((name) => !map.includes(name)),
      'A landing specimen not on `apps/docs/mdx-components.js`s map cannot be ' +
        'mounted on a page at all. Import it there and add it to the object ' +
        '`useMDXComponents` returns.',
    ).toEqual([]);
  });

  it('mounts each one on a page of the content tree', () => {
    const content = pages();

    const unreachable = specimens().filter(
      (name) =>
        !content.some((page) => new RegExp(`<${name}[\\s/>]`).test(page)),
    );

    expect(
      unreachable,
      'Decision 20: a control a reader can operate belongs on the front page ' +
        'and on the demonstration page of the package it advertises. Mount ' +
        'each of these in `apps/docs/content/`.',
    ).toEqual([]);
  });
});
