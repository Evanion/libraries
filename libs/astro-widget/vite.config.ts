/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

const examples = docExamples();

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/astro-widget',
  ...examples,
  plugins: [
    ...examples.plugins,
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      entry: 'src/index.ts',
      name: '@evanion/astro-widget',
      fileName: 'index',
      formats: ['es' as const],
    },
    // `@evanion/widget` is a dependency this package pins exactly, not
    // something to inline: a consumer installing two adapters at the same core
    // version gets one copy of it rather than a copy in each.
    rolldownOptions: { external: ['astro', '@evanion/widget'] },
  },
  test: {
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes. `include` is pinned to
    // *.test-d.ts (matching libs/urn, libs/react-widget, libs/compose) rather than
    // left at vitest's default, because expectTypeOf assertions belong in a
    // dedicated type-only test file: an assertion inside a regular *.test.ts
    // is never type-checked and silently passes regardless of its strength.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // `apps/docs/tools/test-statistics.mjs` reads report.json and
    // coverage-summary.json out of the coverage directory below, and
    // `tools/repo-checks/src/coverage-config.test.ts` holds every library to
    // writing both.
    reporters: [
      'default',
      ['json', { outputFile: './test-output/vitest/coverage/report.json' }],
    ],
    // The same block the other ten libraries carry. Without
    // `reportsDirectory` Vitest's default applies and a coverage run writes to
    // `libs/astro-widget/coverage/`, which `.gitignore`'s root-anchored
    // `/coverage` does not reach, so the run leaves an untracked directory
    // behind.
    coverage: {
      enabled: true,
      reporter: ['json-summary'],
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    // The container tests live in their own project, for the reason
    // vitest.astro.config.ts gives.
    projects: [
      {
        extends: true,
        test: {
          name: '@evanion/astro-widget',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.astro.test.ts'],
          // The README's documented examples. `Widgets.astro` is not among
          // them and cannot be: an `.astro` module is compiled by Astro's own
          // vite plugin, in a consumer's project rather than here. What runs
          // is the half of the surface that is plain TypeScript.
          includeSource: docExampleSources(),
        },
      },
      './vitest.astro.config.ts',
    ],
  },
}));
