import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Test-only config: the app is built by `next build` through next.config.ts,
 * and this file exists both to hold the app's claim to being an RSC demo and
 * because @nx/vitest infers a `test` target from a project-local
 * vite/vitest config, not from the `projects` array in the root
 * vitest.config.ts.
 *
 * `.mts` rather than `.ts`: the app's package.json sets no `"type": "module"`,
 * so a `.ts` config here is loaded as CommonJS and Vite warns about the ESM
 * syntax in it.
 *
 * The conditions are the point of the file. `react-server` is the condition
 * Next resolves react under when it renders a Server Component, and
 * `react/package.json` maps it to `react.react-server.js`, which exports no
 * createContext, useContext, Component or stateful hook. Running the widget
 * here is what proves it needs none of them -- a jsdom run resolves the default
 * entry, where they all exist, and proves nothing.
 *
 * `@evanion/react-widget` declares no `react-server` condition, so it resolves
 * through `import` to its built `dist/`, the same file `next build` resolves.
 * `targetDefaults.test` in nx.json orders that build ahead of this target.
 */
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/storefront-rsc',
  // The app's tsconfig sets `jsx: preserve` for Next, which esbuild cannot emit
  // to runnable JS on its own.
  plugins: [react()],
  resolve: { conditions: ['react-server'] },
  ssr: { resolve: { conditions: ['react-server'] } },
  test: {
    name: '@evanion/storefront-rsc',
    watch: false,
    environment: 'node',
    include: ['app/**/*.server.test.tsx'],
    reporters: ['default'],
  },
});
