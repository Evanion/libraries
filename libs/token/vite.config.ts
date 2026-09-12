import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

// The names the README's later blocks use without reintroducing the import line
// every time. A block that does show its imports shadows these, so the two
// never disagree. `token` is here as well as `createToken`, because the code a
// reader needs in front of them is the call they are reading about, not the
// construction they already saw at the top of the page.
const preamble =
  "import { createToken } from '@evanion/token';\nconst token = createToken();\n";

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/token',
  ...docExamples({ preamble }),
  test: {
    name: '@evanion/token',
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
