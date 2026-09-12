import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
];
