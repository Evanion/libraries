/// <reference types='vitest' />
import { defineConfig } from 'vite';

import {
  docExampleSources,
  docExamples,
} from '@evanion/doc-examples';

// The names the README's later blocks use without reintroducing the import
// line every time. A block that does show its imports shadows these, so the
// two never disagree.
const preamble =
  "import { ALTERNATING_CASE_DICTIONARY, DEFAULT_DICTIONARY, Luhn, createLuhn } from '@evanion/luhn';\n";

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/luhn',
  ...docExamples({ preamble }),
  test: {
    name: '@evanion/luhn',
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
