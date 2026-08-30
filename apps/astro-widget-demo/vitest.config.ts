import { defineConfig } from 'vitest/config';

// Test-only config: astro-widget-demo is an Astro app with its own
// astro.config.mjs for building; this file exists solely so @nx/vitest
// infers a `test` target for the project (Nx infers targets from a
// project-local vite.config.ts/vitest.config.ts, not from entries in the
// root vitest.config.ts's `projects` array), so `render.test.ts` actually
// runs in `nx run-many -t test` / CI / the release gate.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/astro-widget-demo',
  test: {
    name: '@evanion/astro-widget-demo',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
});
