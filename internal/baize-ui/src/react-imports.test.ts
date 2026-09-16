import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The statelessness rule, checked at source: this package imports no React API
 * beyond the ones an element needs to exist.
 *
 * An allowlist and not a denylist. A denylist has to be maintained against
 * React's surface -- `/^use[A-Z]/` misses `createContext`, and naming the
 * client-only APIs misses `useMemo`, which the `react-server` condition happens to
 * provide. Two short lists are readable, and a React API this library has no
 * business importing fails by default.
 *
 * `scripts/verify-packaging.mjs` applies the same allowlist to the packed
 * `dist/index.js`. Two checks of one rule, because they catch different things:
 * this one catches the author, and that one catches a bundler or a dependency
 * reintroducing an import the source does not show.
 */
const ALLOWED: Record<string, readonly string[]> = {
  // A stateless component needs to create elements and to group them.
  react: ['createElement', 'Fragment'],
  // What the automatic JSX runtime emits. `jsxDEV` is the development build's
  // entry for the same thing.
  'react/jsx-runtime': ['jsx', 'jsxs', 'jsxDEV', 'Fragment'],
};

const SRC = join(import.meta.dirname);

const PACKAGING = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'scripts',
  'verify-packaging.mjs',
);

describe('the allowlist', () => {
  /**
   * The packed-output check carries its own copy, because it is a plain node
   * script that runs against a tarball in a temporary directory and cannot import
   * a TypeScript module out of this package. Two copies of one rule drift, so the
   * two are compared: widening the allowlist takes an edit in both places, which
   * is what makes it read as a design change in review rather than as a typo.
   */
  it('is the same list scripts/verify-packaging.mjs applies to the packed entry', () => {
    const source = readFileSync(PACKAGING, 'utf8');
    const literal = /const baizeAllowed = (\{[\s\S]*?\n {2}\});/.exec(source);

    expect(
      literal?.[1],
      `scripts/verify-packaging.mjs no longer declares a \`baizeAllowed\` object ` +
        `this test can read. Keep it, or the two halves of the statelessness ` +
        `guard can disagree.`,
    ).toBeDefined();

    const packed = JSON.parse(
      (literal?.[1] as string)
        .replace(/'/g, '"')
        .replace(/(\w[\w/-]*):/g, '"$1":')
        .replace(/"""/g, '"')
        .replace(/,(\s*[}\]])/g, '$1'),
    ) as Record<string, string[]>;

    expect(packed).toEqual(ALLOWED);
  });
});

/** Every module that ships: `src/`, minus the files `package.json` excludes. */
function shippedModules(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.(?:test|spec|test-d)\.tsx?$/.test(entry.name) &&
        entry.name !== 'test-setup.ts',
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

interface Import {
  module: string;
  specifiers: string[];
  typeOnly: boolean;
}

/**
 * The import statements in a module, as written.
 *
 * Specifiers rather than call sites: rolldown renames imported bindings, so a real
 * context compiles to `import { createContext as t }` and a call to `t(...)`, and
 * grepping for the call finds nothing. The specifier survives every build.
 */
function imports(source: string): Import[] {
  const found: Import[] = [];
  const pattern =
    /import\s+(type\s+)?(?:\{([^}]*)\}|(\*\s+as\s+\w+|\w+))?\s*(?:from\s*)?["']([^"']+)["']/g;

  for (const match of source.matchAll(pattern)) {
    const named = match[2] ?? match[3] ?? '';
    found.push({
      module: match[4] as string,
      typeOnly: Boolean(match[1]),
      specifiers: named
        .split(',')
        .map((specifier) => specifier.trim())
        .filter(Boolean)
        .map((specifier) => specifier.replace(/^type\s+/, ''))
        .map((specifier) => specifier.split(/\s+as\s+/)[0]?.trim() ?? ''),
    });
  }

  return found;
}

describe('every shipped module', () => {
  const modules = shippedModules();

  it('is found at all, or this file proves nothing', () => {
    expect(modules.length).toBeGreaterThan(5);
  });

  for (const file of modules) {
    const name = relative(SRC, file);
    const statements = imports(readFileSync(file, 'utf8'));

    it(`imports only allowed React APIs in ${name}`, () => {
      const offenders = statements
        .filter(
          (statement) =>
            !statement.typeOnly && /^react(?:$|\/|-dom)/.test(statement.module),
        )
        .flatMap((statement) => {
          const allowed = ALLOWED[statement.module];
          if (!allowed) {
            return [`${statement.module} (whole module)`];
          }
          return statement.specifiers
            .filter((specifier) => !allowed.includes(specifier))
            .map((specifier) => `${specifier} from ${statement.module}`);
        });

      expect(
        offenders,
        `src/${name} imports a React API this library is not allowed to use. ` +
          `The allowlist is ${JSON.stringify(ALLOWED)}. Anything else is state, ` +
          `a renderer, or a rendering-model accommodation, and a component that ` +
          `needs one belongs in the app that needs it.`,
      ).toEqual([]);
    });

    it(`imports no stylesheet in ${name}`, () => {
      const stylesheets = statements
        .map((statement) => statement.module)
        .filter((module) => module.endsWith('.css'));

      expect(
        stylesheets,
        `src/${name} imports a stylesheet. Next resolves a CSS import inside a ` +
          `package's module graph; Astro, plain Vite SSR and a bare \`node\` ` +
          `import do not. The app imports @evanion/baize-ui/styles.css once in ` +
          `its root instead.`,
      ).toEqual([]);
    });

    it(`carries no 'use client' directive in ${name}`, () => {
      const firstLine = readFileSync(file, 'utf8').split('\n')[0]?.trim() ?? '';

      expect(
        /^["']use client["'];?$/.test(firstLine),
        `src/${name} starts with a 'use client' directive. Nothing here is ` +
          `client code: a stateless presentational component renders the same ` +
          `in every one of the four apps.`,
      ).toBe(false);
    });
  }
});
