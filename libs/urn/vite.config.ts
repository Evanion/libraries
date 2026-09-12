/// <reference types='vitest' />
import { defineConfig } from 'vite';

import {
  docExampleSources,
  docExamples,
} from '@evanion/doc-examples';

// The names the README's later blocks use without reintroducing the import
// line every time. A block that does show its imports shadows these, so the
// two never disagree.
const preamble = "import { URN } from '@evanion/urn';\n";

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/urn',
  ...docExamples({ preamble }),
  test: {
    // Without an explicit tsconfig, vitest falls back to the solution-style
    // tsconfig.json (files: [], include: []), so it typechecks nothing and
    // every expectTypeOf assertion silently passes.
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.{ts,tsx}'],
    },
    name: '@evanion/urn',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    includeSource: docExampleSources(),
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
