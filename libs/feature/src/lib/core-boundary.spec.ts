import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

/** Every source file the package publishes, test files excluded. */
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(spec|test|test-d)\./.test(entry.name)) return [];
    // `vite.config.ts` names this file in the React project's `setupFiles` and
    // `package.json`'s `files` negates it, so it is a test file whose name
    // carries no `.spec.` or `.test.` segment.
    if (entry.name === 'test-setup.ts') return [];
    return [path];
  });
}

describe('the core', () => {
  it('declares no runtime dependency', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, '../package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    // A browser bundle of this package must not contain a Postgres driver, and
    // a React Native bundle must not contain a Node `http` import. Every
    // adapter that reads configuration from somewhere lives in a sibling
    // package. § 9.
    expect(manifest.dependencies).toBeUndefined();
  });

  it('imports no module outside itself', () => {
    const foreign = sources(ROOT)
      .filter((path) => !path.includes(`${join('src', 'react')}`))
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(/from\s+'([^']+)'/g)].map(
          (match) => ({ path, specifier: match[1] as string }),
        ),
      )
      .filter((each) => !each.specifier.startsWith('.'));

    expect(foreign).toEqual([]);
  });

  it('starts no timer and opens no socket', () => {
    const offences = sources(ROOT).flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return [
        /setInterval/,
        /setTimeout/,
        /\bfetch\(/,
        /XMLHttpRequest/,
        /WebSocket/,
      ]
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${path}: ${String(pattern)}`);
    });

    // The core holds no clock authority and performs no fetch. The party that
    // fetches is the party that acts on `maxStale`, and it lives in
    // `@evanion/feature-source`. § 1, § 9.
    expect(offences).toEqual([]);
  });
});
