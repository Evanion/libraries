/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/compose',
  plugins: [
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
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
