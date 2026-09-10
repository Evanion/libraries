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
