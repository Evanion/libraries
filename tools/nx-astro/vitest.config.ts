import { defineConfig } from 'vitest/config';

// Test-only config: tools/nx-astro is an Nx plugin (its own build/dev/preview
// targets come from the ./tools/nx-astro/src/index.ts plugin entry in
// nx.json), not a Vite-built library. This file exists solely so
// @nx/vitest infers a `test` target for the project (Nx infers targets
// from a project-local vite.config.ts/vitest.config.ts, not from entries
// in the root vitest.config.ts's `projects` array), so index.test.ts
// actually runs in `nx run-many -t test` / CI / the release gate.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/nx-astro',
  test: {
    name: '@evanion/nx-astro',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
  },
});
