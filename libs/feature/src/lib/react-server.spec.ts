import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * A server component imports the core without a `'use client'` boundary, so the
 * whole hydration path (build a store, snapshot it, adopt the set) has to run
 * where `createContext`, `useContext` and every stateful hook are absent. The
 * React adapter is the other half: a client module that supplies the provider
 * and hooks the server component leaves out.
 *
 * The `react-server` export condition is a module-resolution fact, so the first
 * case runs Node under it against the built artifact. No jsdom test can observe
 * the condition. The two directive cases state the split between the core and
 * the adapter as a fact of the built files.
 */
const packageRoot = path.resolve(import.meta.dirname, '..', '..');
const distEntry = path.join(packageRoot, 'dist', 'index.js');
const adapterEntry = path.resolve(
  packageRoot,
  '..',
  'react-feature',
  'dist',
  'index.js',
);

function runUnderReactServer(source: string): string {
  return execFileSync(
    process.execPath,
    ['--conditions=react-server', '--input-type=module', '--eval', source],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

/** Every file under a directory, recursively. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

describe('react-server condition', () => {
  it('builds a store, resolves, and adopts a set with no React on the path', () => {
    expect(
      existsSync(distEntry),
      `${distEntry} is missing -- build @evanion/feature before running this test`,
    ).toBe(true);

    const entryUrl = pathToFileURL(distEntry).href;
    const output = runUnderReactServer(`
      import * as React from 'react';
      import { createFeatures, adoptDecisions } from ${JSON.stringify(entryUrl)};

      const features = createFeatures([
        { key: 'sale', enabled: true,
          rules: [{ when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' }] }] },
      ]);
      const set = features.snapshot({ now: '2026-06-01T00:00:00Z' });
      const adopted = adoptDecisions(features, set, { context: { now: set.now } });

      console.log(JSON.stringify({
        enabled: features.isEnabled('sale', { now: set.now }),
        adopted: adopted.sale.enabled,
        createContext: typeof React.createContext,
      }));
    `);

    expect(JSON.parse(output)).toEqual({
      enabled: true,
      adopted: true,
      // Proves the condition took effect: outside it this is 'function'.
      createContext: 'undefined',
    });
  });

  it('ships no "use client" directive in the core', () => {
    // Anchored at the start of a line so prose explaining the absence does not
    // count as a directive.
    const directive = /^\s*['"]use client['"]\s*;?\s*$/m;
    const files = [
      path.join(packageRoot, 'src', 'index.ts'),
      ...filesUnder(path.join(packageRoot, 'src', 'lib')),
      distEntry,
    ].filter((file) => /\.[cm]?[jt]sx?$/.test(file));

    expect(files.length).toBeGreaterThan(2);
    for (const file of files) {
      expect(
        readFileSync(file, 'utf8'),
        `${path.relative(packageRoot, file)} must not carry a 'use client' directive`,
      ).not.toMatch(directive);
    }
  });

  it('opens the React adapter with the "use client" directive', () => {
    expect(
      existsSync(adapterEntry),
      `${adapterEntry} is missing -- build @evanion/react-feature before running this test`,
    ).toBe(true);

    const firstLine = readFileSync(adapterEntry, 'utf8').split('\n')[0];

    expect(firstLine).toMatch(/^['"]use client['"];?$/);
  });
});
