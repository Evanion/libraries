/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/nx-cache-reporter',
  test: {
    name: '@evanion/nx-cache-reporter',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
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
