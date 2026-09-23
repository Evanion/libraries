/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/acl',
  ...docExamples(),
  test: {
    name: '@evanion/acl',
    watch: false,
    globals: true,
    // node, not jsdom: nothing here touches a DOM, and the package's whole
    // claim is that it runs wherever TypeScript does.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    includeSource: docExampleSources(),
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.ts'],
    },
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
