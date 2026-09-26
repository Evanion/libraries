import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/token',
  // doc-examples.preamble.ts holds the import the README's later blocks use
  // without repeating it. It imports and declares nothing else: a block that
  // calls `token` constructs it on its own first line, because a docs page
  // lifts one block out of the README, and a reader who lands on that page from
  // a search result has seen no other block. The docs app's region loader
  // reads the same file, so a block compiles on a page the way it runs here.
  ...docExamples({ preamble: readPreamble(import.meta.dirname) }),
  test: {
    name: '@evanion/token',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
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
