/// <reference types='vitest' />
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const here = import.meta.dirname;

/**
 * Emits `dist/styles.css`: `src/styles.css` with its one `@import` replaced by
 * the file it names.
 *
 * The stylesheet is not in the JavaScript module graph -- nothing under `src/`
 * imports it, which is the point -- so Vite's own CSS pipeline never sees it. A
 * published `@import './tokens.generated.css'` would also be a second request for
 * every consumer and a relative specifier resolved against whatever directory the
 * consumer's bundler put the file in.
 *
 * Inlining by hand rather than through postcss-import: the only import is this
 * package's own generated file, and `verify-packaging.mjs` asserts the ground
 * hexes are present in `dist/styles.css`, so a build that stopped inlining fails
 * there.
 */
function stylesheet(): Plugin {
  const entry = join(here, 'src', 'styles.css');

  return {
    name: 'baize-stylesheet',
    generateBundle() {
      const source = readFileSync(entry, 'utf8').replace(
        /^@import\s+'([^']+)';$/m,
        (_match, specifier: string) =>
          readFileSync(resolve(dirname(entry), specifier), 'utf8').trimEnd(),
      );

      this.emitFile({ type: 'asset', fileName: 'styles.css', source });
    },
  };
}

export default defineConfig(() => ({
  root: here,
  cacheDir: '../../node_modules/.vite/libs/baize-ui',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: join(here, 'tsconfig.lib.json'),
    }),
    stylesheet(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Two entries, because `./tokens` exists so that a build script, a Nest
      // response or a test can read a token value without React in its graph.
      // They share no runtime code: the components import the token module for
      // its types only, and a type import is erased.
      entry: {
        index: 'src/index.ts',
        'tokens/index': 'src/tokens/index.ts',
      },
      name: '@evanion/baize-ui',
      // ES only, which is the single form package.json declares.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React is a peer dependency, so it resolves to the consumer's copy.
      // Bundling it would put a second React in the graph, and an element
      // created by one copy is not recognised by the other's renderer.
      //
      // class-variance-authority is a declared dependency, and external for the
      // ordinary reason: an app that also uses it gets one copy from its own
      // node_modules instead of a second one inlined here.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'class-variance-authority',
      ],
      output: {
        entryFileNames: '[name].js',
      },
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
          name: '@evanion/baize-ui',
          globals: true,
          environment: 'jsdom',
          include: [
            '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
          exclude: ['**/*.server.{test,spec}.{ts,tsx}'],
        },
      },
      // Evidence that the consequence of statelessness holds in a real resolver.
      // It is not the contract -- the contract is the import allowlist in
      // `react-imports.test.ts`, which also rejects the hooks this condition
      // happens to provide.
      //
      // `react/package.json` maps the `react-server` condition to
      // `react.react-server.js`, which exports no createContext, useContext,
      // Component or stateful hook. Nothing else in this package resolves that
      // condition, so an import of one fails here and nowhere else.
      {
        extends: true,
        resolve: { conditions: ['react-server'] },
        ssr: { resolve: { conditions: ['react-server'] } },
        test: {
          name: '@evanion/baize-ui:react-server',
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
