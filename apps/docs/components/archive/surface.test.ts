import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowed, live } from './surface.mjs';

/**
 * The invariant: a component a cut page may mount reads nothing that changes
 * with `main`.
 *
 * A cut page is served for as long as its release is retained, and the
 * components it names are resolved from `main` on every build. One that imports
 * `app/navigation.ts` makes the old page follow the current navigation, and one
 * that imports a workspace package makes it run `main` under a heading naming
 * an older release. One that imports a JSON file reads data the build writes
 * from `main`. All three are imports, so all three are checked here, over every
 * module the component reaches inside this app.
 */

const app = resolve(import.meta.dirname, '..', '..');
const navigation = join(app, 'app', 'navigation.ts');

/** The design system, which is the site's own prose surface and no release. */
const DESIGN_SYSTEM = '@evanion/baize-ui';

const IMPORT =
  /^\s*(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;

/** A relative specifier as the file it names, or `null` for a stylesheet. */
function fileOf(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (/\.(tsx?|mjs)$/.test(candidate) && existsSync(candidate))
      return candidate;
  }

  return null;
}

/** Every specifier a module reaches, following its relative imports. */
function reach(entry: string): { file: string; specifier: string }[] {
  const seen = new Set<string>();
  const found: { file: string; specifier: string }[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const specifier = (match[1] ?? match[2]) as string;
      found.push({ file, specifier });

      if (specifier.startsWith('.')) {
        const next = fileOf(file, specifier);
        if (next) queue.push(next);
      }
    }
  }

  return found;
}

describe('the components a cut page may mount', () => {
  const modules = [...new Set(allowed.values())].filter(
    (module) => !module.startsWith('@'),
  );

  it('are defined where the list says', () => {
    expect(modules.filter((module) => !existsSync(join(app, module)))).toEqual(
      [],
    );
  });

  it('come from the design system when they come from a package', () => {
    expect(
      [...new Set(allowed.values())].filter(
        (module) => module.startsWith('@') && module !== DESIGN_SYSTEM,
      ),
    ).toEqual([]);
  });

  it('import neither the navigation, a workspace package nor generated data', () => {
    const faults = modules.flatMap((module) =>
      reach(join(app, module)).flatMap(({ file, specifier }) => {
        const where = relative(app, file);

        if (specifier.startsWith('.') && fileOf(file, specifier) === navigation)
          return [`${where}: imports app/navigation.ts`];

        if (specifier.startsWith('@evanion/') && specifier !== DESIGN_SYSTEM)
          return [`${where}: imports ${specifier}`];

        // `statistics.json`, `renders.json` and the behaviour index are
        // written from main's sources before every build.
        if (specifier.endsWith('.json'))
          return [`${where}: imports ${specifier}`];

        return [];
      }),
    );

    expect(
      faults,
      'A component a cut page mounts is resolved from main on every build. ' +
        'Pass what it needs as a literal prop, which the cut writes, instead.',
    ).toEqual([]);
  });

  it('are never also the live ones the cut replaces', () => {
    expect([...allowed.keys()].filter((name) => live.has(name))).toEqual([]);
  });
});
