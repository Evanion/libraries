/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/widget',
  ...docExamples(),
  test: {
    name: '@evanion/widget',
    watch: false,
    globals: true,
    // node, not jsdom: nothing here touches a DOM, and the package's whole
    // claim is that it runs wherever TypeScript does.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // The README's marked blocks, and the `@example` blocks in `src/`. The
    // pages under `apps/docs/content/widget/` render these regions, so a page
    // shows code this run executed rather than a copy of it.
    includeSource: docExampleSources(),
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.ts'],
    },
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
