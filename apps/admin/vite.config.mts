/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/admin',
  server: { port: 4200, host: 'localhost' },
  preview: { port: 4200, host: 'localhost' },
  // The React Router plugin owns the build inputs and the SSR environment, and
  // under vitest there is neither: the tests render route modules and widget
  // regions directly. Leaving it on makes vitest try to resolve the framework's
  // virtual server entry and fail before a test runs.
  plugins: [!process.env['VITEST'] && reactRouter()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: 'admin',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
