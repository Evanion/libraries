import nx from '@nx/eslint-plugin';

/**
 * Rules every project should end up with.
 *
 * Exported because the per-project configs spread an nx preset *after* this
 * file, and those presets re-enable some of what is set here. Each project
 * applies these last so they actually win.
 */
export const sharedRules = {
  // These libraries advertise type safety, so an untyped escape hatch is a
  // defect rather than a style preference. The two that remain are generic
  // *constraint* positions TypeScript offers no alternative for, and each
  // carries an inline disable explaining why.
  '@typescript-eslint/no-explicit-any': 'error',

  // The base rule does not understand TypeScript overload signatures and flags
  // every overloaded function as a redeclaration.
  'no-redeclare': 'off',
  '@typescript-eslint/no-redeclare': 'error',
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: sharedRules,
  },
];
