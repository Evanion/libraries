import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Astro regenerates .astro/ on every build: machine-written type shims full
    // of `any` and a triple-slash reference. Linting generated files reports
    // problems no one can fix in source.
    ignores: ['.astro/**', 'dist/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
];
