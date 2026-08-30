import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      '**/vite.config.{mjs,js,ts,mts}',
      '**/vitest.config.{mjs,js,ts,mts}',
      '!vitest.config.ts',
      {
        test: {
          name: '@evanion/nx-astro',
          root: 'tools/nx-astro',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        },
      },
      // astro-widget-demo has no vite.config.ts/vitest.config.ts of its own
      // (it's an Astro app, not a Vite lib), so the glob patterns above never
      // pick it up. Without this explicit entry, `npx vitest run
      // apps/astro-widget-demo` silently discovers zero tests.
      {
        test: {
          name: '@evanion/astro-widget-demo',
          root: 'apps/astro-widget-demo',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        },
      },
    ],
  },
});
