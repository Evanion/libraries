/// <reference types='vitest' />
import { defaultServerConditions } from 'vite';
import { getViteConfig } from 'astro/config';

/**
 * Vitest project for the checks that render an `.astro` component.
 *
 * Compiling a `.astro` module needs Astro's own vite plugin, and the project in
 * vitest.config.ts must not carry it -- the rest of these checks run against
 * the Nx project graph and the filesystem, and loading Astro for them costs a
 * second per run. Hence a second config, referenced from that file's
 * `test.projects`.
 *
 * The `@evanion/source` conditions are repeated here rather than inherited:
 * `getViteConfig` builds Astro's config from scratch, so nothing from the
 * sibling project reaches it.
 */
export default getViteConfig({
  resolve: {
    conditions: ['@evanion/source', ...defaultServerConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@evanion/source', ...defaultServerConditions],
      externalConditions: ['@evanion/source', ...defaultServerConditions],
    },
  },
  test: {
    name: '@evanion/repo-checks:astro',
    globals: true,
    environment: 'node',
    include: ['src/**/*.astro.test.ts'],
    reporters: ['default'],
  },
});
