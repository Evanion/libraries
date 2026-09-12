import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Test-only config: the docs site is built by `next build` through
 * next.config.ts, and this file exists so @nx/vitest infers a `test` target for
 * the project. Nx infers that target from a project-local
 * vite.config.ts/vitest.config.ts, not from the `projects` array in the root
 * vitest.config.ts, so without this the playground tests would run only in a
 * by-hand `vitest` and never in CI or the release gate.
 *
 * `.mts` rather than `.ts`: the app's package.json sets no `"type": "module"`,
 * because postcss-load-config reads postcss.config.js as CommonJS for
 * `next build`, so a `.ts` config here is loaded as CommonJS and Vite warns
 * about the ESM syntax in it.
 *
 * No condition is set for `@evanion/react-widget`, so it resolves through
 * `import` to the package's built `dist/`, the same way the Next build resolves
 * it. `targetDefaults.test` in nx.json orders that build ahead of this target.
 */
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/docs',
  // The docs tsconfig sets `jsx: preserve` for Next, which esbuild cannot emit
  // to runnable JS on its own.
  plugins: [react()],
  test: {
    name: '@evanion/docs',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['components/**/*.test.{ts,tsx}'],
    reporters: ['default'],
  },
});
