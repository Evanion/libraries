import { defineConfig } from 'vitest/config';

// Test-only config, the same shape as tools/repo-checks's: Nx infers the `test`
// target from a project-local vitest config.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/docs-redirect-worker',
  test: {
    name: '@evanion/docs-redirect-worker',
    watch: false,
    environment: 'node',
    include: ['src/**/*.test.js'],
    reporters: ['default'],
  },
});
