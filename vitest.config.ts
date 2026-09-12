import { defineConfig } from 'vitest/config';

/**
 * The workspace-wide `vitest` run: every project's own config, as a Vitest
 * project.
 *
 * This is for running the whole suite by hand. CI and the release gate go
 * through `nx run-many -t test`, which runs each project's config directly and
 * never reads this file -- @nx/vitest infers a project's `test` target from a
 * project-local vite.config/vitest.config, not from the list below. A project
 * added here but missing such a file runs here and nowhere else.
 */
export default defineConfig({
  test: {
    projects: [
      '**/vite.config.{mjs,js,ts,mts}',
      '**/vitest.config.{mjs,js,ts,mts}',
      // This file matches its own glob, and a config that lists itself as a
      // project recurses.
      '!vitest.config.ts',
    ],
  },
});
