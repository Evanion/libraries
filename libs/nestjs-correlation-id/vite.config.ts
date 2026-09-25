/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/nestjs-correlation-id',
  // doc-examples.preamble.ts builds the service and the middleware the README's
  // regions call, so a region shows the call rather than the wiring around it.
  // The docs app's region loader reads the same file, so a block compiles on a
  // page the way it runs here.
  ...docExamples({ preamble: readPreamble(import.meta.dirname) }),
  test: {
    // No vitest `typecheck` block: there are no *.test-d.ts files here for a
    // glob to match. `nx typecheck` builds tsconfig.json, which references
    // both tsconfig.lib.json and tsconfig.spec.json, so sources and specs are
    // both typechecked there.
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
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
      // v8 coverage is collected from the modules the run actually loaded, so
      // without an explicit include a source file no test imports is absent
      // from the report rather than reported as uncovered, and the percentage
      // is computed over the loaded subset.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/index.ts'],
    },
  },
}));
