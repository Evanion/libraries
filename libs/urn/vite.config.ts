/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/urn',
  // doc-examples.preamble.ts holds the names the README's later blocks use
  // without reintroducing the import line every time. The docs app's region
  // loader reads the same file, so a block compiles on a page the way it runs
  // here.
  ...docExamples({ preamble: readPreamble(import.meta.dirname) }),
  test: {
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
    name: '@evanion/urn',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    includeSource: docExampleSources(),
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
