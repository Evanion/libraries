import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    /**
     * `examples/` imports `@evanion/nestjs-correlation-id` by its published
     * specifier.
     *
     * Those files are what the documentation pages render, region for region,
     * so a reader copies the import line along with the rest of the listing. A
     * relative path into `src/` would be a line nobody outside this repository
     * can run, which is the one thing an example may not be.
     */
    files: ['examples/**/*.ts'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
];
