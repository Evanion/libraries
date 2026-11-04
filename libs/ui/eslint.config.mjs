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
    // The root config turns this off for the preamble, and `sharedRules` above
    // turns it back on: the names it imports are used by the README's
    // examples, which nothing here lints.
    files: ['doc-examples.preamble.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
];
