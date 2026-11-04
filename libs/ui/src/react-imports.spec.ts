import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The statelessness rule, checked at source: no module here imports a React
 * API beyond the ones an element needs to exist.
 *
 * An allowlist, so a hook, a context or a class component fails by default.
 * `scripts/verify-packaging.mjs` applies the same list to the packed
 * `dist/index.js`, which catches a bundler reintroducing an import the source
 * does not show. The two copies are compared below.
 */
const ALLOWED: Record<string, readonly string[]> = {
  react: ['createElement', 'Fragment'],
  'react/jsx-runtime': ['jsx', 'jsxs', 'jsxDEV', 'Fragment'],
};

const SRC = import.meta.dirname;
const PACKAGING = join(
  SRC,
  '..',
  '..',
  '..',
  'scripts',
  'verify-packaging.mjs',
);

describe('the allowlist', () => {
  it('is the same list scripts/verify-packaging.mjs applies to the packed entry', () => {
    const source = readFileSync(PACKAGING, 'utf8');
    const literal = /const uiAllowed = (\{[\s\S]*?\n {2}\});/.exec(source)?.[1];

    expect(
      literal,
      'verify-packaging.mjs declares no `uiAllowed`',
    ).toBeDefined();

    const packed = JSON.parse(
      (literal as string)
        .replace(/'/g, '"')
        .replace(/(\w[\w/-]*):/g, '"$1":')
        .replace(/"""/g, '"')
        .replace(/,(\s*[}\]])/g, '$1'),
    ) as Record<string, string[]>;

    expect(packed).toEqual(ALLOWED);
  });
});

/** Every module that ships: `src/`, minus tests and setup. */
const shipped = readdirSync(SRC, { recursive: true, withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      /\.tsx?$/.test(entry.name) &&
      !/\.(?:test|spec|test-d)\.tsx?$/.test(entry.name) &&
      entry.name !== 'test-setup.ts',
  )
  .map((entry) => join(entry.parentPath, entry.name));

const IMPORT =
  /import\s+(type\s+)?(?:\{([^}]*)\}|(\*\s+as\s+\w+|\w+))?\s*(?:from\s*)?["']([^"']+)["']/g;

describe('every shipped module', () => {
  it('is found at all, or this file proves nothing', () => {
    expect(shipped.length).toBeGreaterThan(8);
  });

  for (const file of shipped) {
    const name = relative(SRC, file);
    const source = readFileSync(file, 'utf8');

    it(`imports only allowed React APIs, and no stylesheet, in ${name}`, () => {
      const offenders: string[] = [];

      for (const match of source.matchAll(IMPORT)) {
        const module = match[4] as string;
        if (module.endsWith('.css')) offenders.push(module);
        if (match[1] || !/^react(?:$|\/|-dom)/.test(module)) continue;

        const allowed = ALLOWED[module];
        if (!allowed) {
          offenders.push(`${module} (whole module)`);
          continue;
        }
        (match[2] ?? match[3] ?? '')
          .split(',')
          .map((specifier) => specifier.trim().replace(/^type\s+/, ''))
          .filter((specifier) => specifier && !/^type\s/.test(specifier))
          .map((specifier) => specifier.split(/\s+as\s+/)[0]?.trim() ?? '')
          .filter((specifier) => !allowed.includes(specifier))
          .forEach((specifier) =>
            offenders.push(`${specifier} from ${module}`),
          );
      }

      expect(offenders).toEqual([]);
    });

    it(`carries no 'use client' directive in ${name}`, () => {
      expect(source.split('\n')[0]?.trim()).not.toMatch(
        /^["']use client["'];?$/,
      );
    });
  }
});
