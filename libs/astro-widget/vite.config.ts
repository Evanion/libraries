/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/astro-widget',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      entry: 'src/index.ts',
      name: '@evanion/astro-widget',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: { external: ['astro'] },
  },
  test: {
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes. `include` is pinned to
    // *.test-d.ts (matching libs/urn, libs/widget, libs/compose) rather than
    // left at vitest's default, because expectTypeOf assertions belong in a
    // dedicated type-only test file: an assertion inside a regular *.test.ts
    // is never type-checked and silently passes regardless of its strength.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
}));
