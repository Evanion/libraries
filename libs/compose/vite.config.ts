/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

// doc-examples.preamble.ts holds the imports the README's regions stand on, so a
// region shows the composition rather than the lines above it. The docs app's
// region loader reads the same file, so a block compiles on a page the way it
// runs here.
const examples = docExamples({ preamble: readPreamble(import.meta.dirname) });

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/compose',
  ...examples,
  plugins: [
    ...examples.plugins,
    react(),
    // The published `dist/*.d.ts` files come from here, not from tsc: this
    // build owns `dist` and empties it, so tsc emits to a throwaway directory
    // instead. See the `outDir` note in tsconfig.lib.json.
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
      name: '@evanion/compose',
      fileName: 'index',
      // ESM only, which is what package.json declares: there is no `require`
      // condition in its exports map and no CJS artifact to point one at.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React is a peer dependency. Bundling it would give a consumer a second
      // React instance, and two instances share no context or hook state.
      // `react/jsx-runtime` is listed separately because the automatic JSX
      // transform imports it directly, not through `react`.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
  test: {
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
    name: '@evanion/compose',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // The README's documented examples. The sources are `.tsx` here, so the
    // glob takes that extension rather than the `.ts` default.
    includeSource: docExampleSources('tsx'),
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
  },
}));
