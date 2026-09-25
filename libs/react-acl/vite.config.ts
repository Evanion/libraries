/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

import { docExampleSources, docExamples } from '@evanion/doc-examples';
import { readPreamble } from '@evanion/doc-examples/preamble';

// doc-examples.preamble.ts holds the imports the README's regions stand on, so a
// region shows the provider and the hook rather than the lines above them. The
// docs app's region loader reads the same file, so a block compiles on a page the
// way it runs here.
const examples = docExamples({ preamble: readPreamble(import.meta.dirname) });

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/react-acl',
  ...examples,
  plugins: [
    ...examples.plugins,
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
      entry: 'src/index.tsx',
      name: '@evanion/react-acl',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      // React and the core are peers/dependencies, so they resolve to the
      // consumer's copies. Bundling them would put a second React in the graph
      // and inline the core into every adapter.
      external: ['react', 'react-dom', 'react/jsx-runtime', '@evanion/acl'],
    },
  },
  test: {
    name: '@evanion/react-acl',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The README's documented examples. The sources are `.tsx` here, so the
    // glob takes that extension rather than the `.ts` default.
    includeSource: docExampleSources('tsx'),
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
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
