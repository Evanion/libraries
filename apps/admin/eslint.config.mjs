import nx from '@nx/eslint-plugin';
import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    // `build/` is the React Router bundle and `.react-router/` is the typegen
    // output, rewritten on every build. Linting generated files reports problems
    // no one can fix in source.
    ignores: ['build/**', 'dist/**', '.react-router/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
];
