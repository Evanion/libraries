/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/widget',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@evanion/react-widget',
      fileName: 'index',
      // ES only, which is the single form package.json declares: `type:
      // module` plus an exports map whose every condition points at
      // `dist/index.js`.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React is a peer dependency, so it resolves to the consumer's copy.
      // Bundling it would put a second React in the graph, and an element
      // created by one copy is not recognised by the other's renderer.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
  test: {
    watch: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    projects: [
      {
        extends: true,
        test: {
          // Without an explicit tsconfig, vitest falls back to the
          // solution-style tsconfig.json (files: [], include: []), so it
          // typechecks nothing and every expectTypeOf assertion silently
          // passes.
          typecheck: {
            enabled: true,
            tsconfig: './tsconfig.spec.json',
            include: ['src/**/*.test-d.{ts,tsx}'],
          },
          name: '@evanion/react-widget',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: [
            '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
          exclude: ['**/*.server.{test,spec}.{ts,tsx}'],
        },
      },
      // The project that holds this package to its Server Component promise.
      // `react/package.json` maps the `react-server` condition to
      // `react.react-server.js`, which exports no createContext, useContext,
      // Component or stateful hook. Nothing else in the repo resolves that
      // condition -- the library build and the jsdom project both get the
      // default entry, where every one of those exports is present -- so an
      // import of one fails here and nowhere else.
      {
        extends: true,
        resolve: { conditions: ['react-server'] },
        ssr: { resolve: { conditions: ['react-server'] } },
        test: {
          name: '@evanion/react-widget:react-server',
          globals: true,
          environment: 'node',
          include: ['src/**/*.server.{test,spec}.{ts,tsx}'],
          // react is externalised by default, which would hand it to Node's
          // resolver and lose the condition set above.
          server: { deps: { inline: [/^react(\/|$)/] } },
        },
      },
    ],
  },
}));
