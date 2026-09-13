import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** A package as installed at the workspace root. */
function workspaceModule(name: string): string {
  return fileURLToPath(new URL(`../../node_modules/${name}`, import.meta.url));
}

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
  // This app pins the React that Next 16 ships against, one minor behind the
  // workspace's, so `apps/docs/node_modules` holds a second copy. A component
  // under test would take its hooks from that copy while
  // `@testing-library/react`, which Node loads from the workspace root as an
  // external dependency, renders with the other -- and the first hook call
  // reads a dispatcher that is not there. So under test every `react` import
  // is the workspace's copy, the one the testing library already renders
  // with. One minor ahead of what the site ships, which nothing here depends
  // on.
  resolve: {
    alias: [
      { find: /^react$/, replacement: workspaceModule('react') },
      { find: /^react\/(.*)$/, replacement: `${workspaceModule('react')}/$1` },
      { find: /^react-dom$/, replacement: workspaceModule('react-dom') },
      {
        find: /^react-dom\/(.*)$/,
        replacement: `${workspaceModule('react-dom')}/$1`,
      },
    ],
  },
  test: {
    name: '@evanion/docs',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    include: ['{app,components}/**/*.test.{ts,tsx}'],
    reporters: ['default'],
  },
});
