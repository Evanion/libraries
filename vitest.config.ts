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
    ],
  },
});
