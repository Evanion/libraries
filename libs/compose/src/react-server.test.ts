import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * The package is imported from React Server Components without a `'use client'`
 * boundary, so it may only touch React APIs that exist under the `react-server`
 * export condition. `createContext`, `useContext`, `Component` and every
 * stateful hook are absent there -- reaching for one is a runtime `TypeError` in
 * a Next.js `app/layout.tsx`, which no jsdom test can see.
 *
 * This drives a real `node --conditions=react-server` against the built
 * artifact for that reason: the condition is a module-resolution fact, and only
 * Node resolving it for real proves anything.
 */
const packageRoot = path.resolve(import.meta.dirname, '..');
const distEntry = path.join(packageRoot, 'dist', 'index.js');

function runUnderReactServer(source: string): string {
  return execFileSync(
    process.execPath,
    ['--conditions=react-server', '--input-type=module', '--eval', source],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

describe('react-server condition', () => {
  it('ships no "use client" directive', () => {
    // Anchored at the start of a line so the prose in Compose.tsx explaining
    // why there is no directive does not count as one.
    const directive = /^\s*['"]use client['"]\s*;?\s*$/m;

    for (const file of ['src/Compose.tsx', 'src/index.ts', 'dist/index.js']) {
      expect(
        readFileSync(path.join(packageRoot, file), 'utf8'),
        `${file} must not carry a 'use client' directive`,
      ).not.toMatch(directive);
    }
  });

  it('imports and renders under the react-server condition', () => {
    expect(
      existsSync(distEntry),
      `${distEntry} is missing -- build @evanion/compose before running this test`,
    ).toBe(true);

    const entryUrl = pathToFileURL(distEntry).href;
    const output = runUnderReactServer(`
      import * as React from 'react';
      import { ComposeProvider, provider } from ${JSON.stringify(entryUrl)};

      const Simple = ({ children }) => React.createElement('div', null, children);
      const Themed = ({ theme, children }) =>
        React.createElement('div', { 'data-theme': theme }, children);

      const element = ComposeProvider({
        providers: [Simple, provider(Themed, { theme: 'dark' })],
        children: 'hello',
      });

      console.log(
        JSON.stringify({
          valid: React.isValidElement(element),
          useContext: typeof React.useContext,
        }),
      );
    `);

    expect(JSON.parse(output)).toEqual({
      valid: true,
      // Proves the condition actually took effect: outside it this is
      // 'function'.
      useContext: 'undefined',
    });
  });
});
