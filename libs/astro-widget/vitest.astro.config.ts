/// <reference types='vitest' />
import { getViteConfig } from 'astro/config';

/**
 * Vitest project for the tests that render `Widgets.astro` through Astro's
 * container API.
 *
 * `Widgets.astro` is the one source file in this package the type checker
 * cannot see into, so it is the one that has to be rendered to be tested.
 * Compiling a `.astro` module needs Astro's own vite plugin, and the library
 * build in vite.config.ts must not carry that plugin -- hence a second config,
 * referenced from that file's `test.projects`.
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
