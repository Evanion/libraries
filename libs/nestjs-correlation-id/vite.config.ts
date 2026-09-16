/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/nestjs-correlation-id',
  test: {
    // No vitest `typecheck` block: there are no *.test-d.ts files here for a
    // glob to match. `nx typecheck` builds tsconfig.json, which references
    // both tsconfig.lib.json and tsconfig.spec.json, so sources and specs are
    // both typechecked there.
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
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
