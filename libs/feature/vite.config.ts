/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

const examples = docExamples();

// No `build` section on purpose. The package is built by `tsc`
// (tsconfig.lib.json), not bundled: file-per-file emit gives each entry its own
// module, and `scripts/verify-packaging.mjs` resolves the published entry
// against that output.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/feature',
  ...examples,
  plugins: [...examples.plugins],
  test: {
    name: '@evanion/feature',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/lib/**/*.{test,spec}.ts'],
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []). It then typechecks nothing and
    // every expectTypeOf assertion passes whatever it asserts. Both extensions
    // are listed because a glob keyed on one leaves a file the project owns
    // unattributed.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/lib/**/*.test-d.{ts,tsx}'],
    },
    // The documented examples, executed. Every region is a `@evanion/feature`
    // call and none of them touches a DOM.
    includeSource: docExampleSources(),
    // `apps/docs/tools/test-statistics.mjs` reads report.json and
    // coverage-summary.json out of the coverage directory below, and
    // `tools/repo-checks/src/coverage-config.test.ts` holds every library to
    // writing both.
    reporters: [
      'default',
      ['json', { outputFile: './test-output/vitest/coverage/report.json' }],
    ],
    coverage: {
      enabled: true,
      reporter: ['json-summary'],
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
