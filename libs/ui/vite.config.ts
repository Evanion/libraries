/// <reference types='vitest' />
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

const here = import.meta.dirname;

/**
 * `src/styles/index.css` as one file: each `@import './x.css' layer(name);`
 * becomes `@layer name { … }` holding that file.
 *
 * The stylesheet is not in the JavaScript module graph (no component imports
 * CSS), so Vite's CSS pipeline never sees it. Inlining here means a consumer
 * gets one request and no relative `@import` resolved against wherever their
 * bundler put the file. No PostCSS: every value in the source is already plain
 * CSS.
 */
export function bundleStylesheet(entry: string): string {
  return readFileSync(entry, 'utf8').replace(
    /^@import\s+'([^']+)'\s+layer\(([\w-]+)\);$/gm,
    (_match, specifier: string, layer: string) => {
      const body = readFileSync(resolve(dirname(entry), specifier), 'utf8')
        .trimEnd()
        .replace(/^(?=.)/gm, '  ');

      return `@layer ${layer} {\n${body}\n}`;
    },
  );
}

function stylesheet(): Plugin {
  return {
    name: 'evanion-ui-stylesheet',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'styles.css',
        source: bundleStylesheet(join(here, 'src', 'styles', 'index.css')),
      });
    },
  };
}

// doc-examples.preamble.ts holds the imports the README's regions stand on.
const examples = docExamples({ preamble: readPreamble(here) });

export default defineConfig(() => ({
  root: here,
  cacheDir: '../../node_modules/.vite/libs/ui',
  ...examples,
  plugins: [
    ...examples.plugins,
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
    lib: {
      // Two entries: the components, and the copy helper. The helper is plain
      // DOM, and an app that never copies anything never loads it.
      entry: {
        index: 'src/index.ts',
        client: 'src/client.ts',
      },
      name: '@evanion/ui',
      // ES only, which is the single form package.json declares.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React is a peer dependency, so it resolves to the consumer's copy.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    watch: false,
    // `apps/docs/tools/test-statistics.mjs` reads report.json and
    // coverage-summary.json out of the coverage directory below, and
    // `tools/repo-checks/src/coverage-config.test.ts` holds every library to
    // writing both.
    reporters: [
      'default',
      ['json', { outputFile: './test-output/vitest/coverage/report.json' }],
    ],
    coverage: {
      enabled: true,
      reporter: ['json-summary'],
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    projects: [
      {
        extends: true,
        test: {
          name: '@evanion/ui',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.server.{test,spec}.{ts,tsx}'],
          // The README's documented examples, executed.
          includeSource: docExampleSources('tsx'),
          typecheck: {
            enabled: true,
            tsconfig: './tsconfig.spec.json',
            include: ['src/**/*.test-d.{ts,tsx}'],
          },
        },
      },
      // The statelessness promise in a real resolver. `react-server` maps
      // React to the build that exports no hook, context or class component,
      // so an import of one fails here and nowhere else.
      {
        extends: true,
        resolve: { conditions: ['react-server'] },
        ssr: { resolve: { conditions: ['react-server'] } },
        test: {
          name: '@evanion/ui:react-server',
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
