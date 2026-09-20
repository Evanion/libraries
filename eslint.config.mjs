import nx from '@nx/eslint-plugin';

/**
 * Rules every project ends up with, whatever else its own config pulls in.
 *
 * Exported because a per-project config spreads an nx preset after this file and
 * those presets re-enable some of what is set here. Applying this object last in
 * each project's config is what makes these the effective settings.
 */
export const sharedRules = {
  // An error, not a warning: these packages are published as typed, so an `any`
  // in a public signature is a defect in the product. Where TypeScript offers no
  // alternative -- a generic constraint position -- the `any` carries an inline
  // disable naming the reason.
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
      // Where tsc puts the declarations it emits only because `tsc --build`
      // has no check-only mode. Generated, never shipped, never read.
      '**/out-tsc',
      // Vite writes these beside a TypeScript config while loading it, and
      // deletes them again. A lint run that catches one mid-build fails on a
      // file that no longer exists.
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
          // Build-time tooling that never reaches a shipped artefact. The
          // eslint config is lint-only. @evanion/doc-examples is imported by
          // each package's vite.config.ts to run the documented examples as
          // tests, and by apps/docs to read a README region while it
          // prerenders -- both at build time, neither in what the build
          // produces. Without this, enforceBuildableLibDependency rejects a
          // buildable project for importing either one.
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '^@evanion/doc-examples(/.+)?$',
          ],
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
    // The lines a package's README examples stand on, read by the doctest run
    // and by the docs app's region loader. Nothing imports this file: both
    // sides read it as text and put it in front of an example. It has to write
    // the specifier a reader would install, so the relative-import rule is
    // wrong here, and the names it brings in are used by the example that
    // follows it rather than by the file itself.
    files: ['**/doc-examples.preamble.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
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
