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
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '@evanion/react-widget',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
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
      // This package is importable from a React Server Component because it
      // never carries 'use client'. React's `react-server` export condition
      // omits createContext, useContext, Component and every stateful hook, so
      // a reintroduced import breaks that silently: the build succeeds and
      // every jsdom test still passes. This project resolves react under that
      // condition so the failure surfaces here.
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
