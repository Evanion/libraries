import nx from '@nx/eslint-plugin';
import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
  {
    /**
     * `examples/` imports `@evanion/compose` by its published specifier.
     *
     * Those files are what the documentation pages render, region for region,
     * so a reader copies the import line along with the rest of the listing. A
     * relative path into `src/` would be a line nobody outside this repository
     * can run, which is the one thing an example may not be.
     */
    files: ['examples/**/*.tsx'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
];
