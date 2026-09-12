/// <reference types='vitest' />
import { defineConfig } from 'vitest/config';

/**
 * Test-only config: storefront is an Astro app with its own astro.config.mjs for
 * building. This file exists so @nx/vitest infers a `test` target for the project
 * -- Nx infers targets from a project-local vite.config.ts/vitest.config.ts, not
 * from entries in the root vitest.config.ts's `projects` array.
 *
 * Two projects, because rendering a `.astro` module needs Astro's own vite
 * plugin and the plain unit tests must not carry it. vitest.astro.config.ts is
 * the other one.
 */
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/storefront',
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    reporters: ['default'],
    projects: [
      {
        extends: true,
        test: {
          name: '@evanion/storefront',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.astro.test.ts'],
        },
      },
      './vitest.astro.config.ts',
    ],
  },
});
