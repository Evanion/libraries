/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

const examples = docExamples();

// No `build` section on purpose. The package is built by `tsc`
// (tsconfig.lib.json), not bundled: a bundle is one module and cannot carry a
// per-module `'use client'` directive, which `src/react/index.tsx` needs and
// `src/index.ts` must not have. File-per-file emit gives each entry its own
// module and keeps the directive where it belongs.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/feature',
  ...examples,
  // `react()` after the doc-example plugins: `expectComments` is `enforce: 'pre'`
  // and doctest reads what it wrote, so neither one's position here moves them.
  plugins: [...examples.plugins, react()],
  test: {
    watch: false,
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
    projects: [
      {
        extends: true,
        test: {
          name: '@evanion/feature',
          globals: true,
          environment: 'node',
          include: ['src/lib/**/*.{test,spec}.ts'],
          // The README's documented examples, executed. The core suite is the
          // one that runs them: every region is a `@evanion/feature` call and
          // none of them touches a DOM.
          includeSource: docExampleSources(),
        },
      },
      // The React adapter is the only part that needs a DOM. Kept as its own
      // project so the core suite keeps running in `node`, where an accidental
      // dependency on a browser global fails instead of passing.
      {
        extends: true,
        test: {
          name: '@evanion/feature:react',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/react/**/*.{test,spec}.tsx'],
        },
      },
    ],
  },
}));
