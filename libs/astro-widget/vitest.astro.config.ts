/// <reference types='vitest' />
import { getViteConfig } from 'astro/config';

/**
 * Vitest project for the tests that render `Widgets.astro` through Astro's
 * container API.
 *
 * It needs Astro's own vite plugin to compile a `.astro` module, and the
 * library build in `vite.config.ts` must not carry that plugin -- hence a
 * separate config, referenced from that file's `test.projects`.
 */
export default getViteConfig({
  test: {
    name: '@evanion/astro-widget:astro',
    globals: true,
    environment: 'node',
    include: ['src/**/*.astro.test.ts'],
    reporters: ['default'],
  },
});
