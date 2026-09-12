import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Test-only config, the same shape as tools/nx-astro's. tools/repo-checks
// holds workspace invariants, not shipped code. Nx infers targets from a
// project-local vite.config.ts/vitest.config.ts and not from the root
// vitest.config.ts's `projects` array, so this file is what makes @nx/vitest
// give the project a `test` target -- which is what puts these checks into
// `nx run-many -t test`, CI, and the release gate.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/repo-checks',
  // In-workspace `@evanion/*` imports resolve to TypeScript source through the
  // `@evanion/source` export condition, the same one tsconfig.base.json sets
  // for the type checker. Without it a check that imports a sibling package
  // resolves to `dist`, which a test run does not build.
  resolve: {
    conditions: ['@evanion/source', ...defaultServerConditions],
  },
  // Vitest resolves a bare specifier in the ssr environment, which uses its own
  // condition lists.
  ssr: {
    resolve: {
      conditions: ['@evanion/source', ...defaultServerConditions],
      externalConditions: ['@evanion/source', ...defaultServerConditions],
    },
  },
  test: {
    name: '@evanion/repo-checks',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    // The project graph is slower than a unit test.
    testTimeout: 120_000,
  },
});
