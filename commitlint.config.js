module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // A new feature
        'fix', // A bug fix
        'docs', // Documentation only changes
        'style', // Changes that do not affect the meaning of the code
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'perf', // A code change that improves performance
        'test', // Adding missing tests or correcting existing tests
        'build', // Changes that affect the build system or external dependencies
        'ci', // Changes to our CI configuration files and scripts
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
      ],
    ],
    // Scopes for packages MUST equal the Nx project name with the `@evanion/`
    // prefix stripped. Nx resolves conventional-commit scopes against project
    // names, so a scope that does not match a project (`widget` vs the project
    // `react-widget`) is attributed to nothing and silently downgraded to a
    // patch bump instead of erroring.
    //
    // This list is deliberately STATIC. Deriving it from the Nx project graph
    // would run a graph computation inside the commit-msg hook on every single
    // commit. `tools/repo-checks` has a test that fails the build if a project
    // under nx.json's `release.projects` globs is missing from this list.
    'scope-enum': [
      2,
      'always',
      [
        // Nx projects (bare project names).
        'astro-widget',
        'compose',
        'docs',
        'luhn',
        'nestjs-correlation-id',
        'nx-astro',
        'react-widget',
        'repo-checks',
        'storefront',
        'urn',
        // Repository scopes -- not projects. Taken from the scopes already in
        // use on main, so existing practice keeps working.
        'ci',
        'deps',
        'deps-dev',
        'libs',
        'nx',
        'packaging',
        'prettier',
        'release',
        'releasing',
        'repo',
        'specs',
        'types',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
};
