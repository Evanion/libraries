import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/token',
  // doc-examples.preamble.ts holds the names the README's later blocks use
  // without reintroducing the import line every time. It declares `token` as
  // well as `createToken`, because the code a reader needs in front of them is
  // the call they are reading about, not the construction they already saw at
  // the top of the page. The docs app's region loader reads the same file, so
  // a block compiles on a page the way it runs here.
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
