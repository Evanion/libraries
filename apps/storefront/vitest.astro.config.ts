/// <reference types='vitest' />
import { getViteConfig } from 'astro/config';

/**
 * Vitest project for the region tests, which render `.astro` blocks and chrome
 * through Astro's container API.
 *
 * Compiling a `.astro` module needs Astro's own vite plugin, which `getViteConfig`
 * supplies. The plain unit tests in vitest.config.ts must not carry it, hence two
 * projects.
 */
export default getViteConfig({
  test: {
    name: '@evanion/storefront:astro',
    globals: true,
    environment: 'node',
    include: ['src/**/*.astro.test.ts'],
    reporters: ['default'],
  },
});
