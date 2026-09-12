module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The types @commitlint/config-conventional allows, restated so the list is
    // the one nx knows. nx reads the type to choose the bump: `feat` is a minor,
    // `fix` a patch, a `!` or BREAKING CHANGE footer a major whatever the type,
    // and every other type bumps nothing on its own
    // (DEFAULT_CONVENTIONAL_COMMITS_CONFIG in nx's release config). A type nx has
    // no entry for releases nothing and appears in no changelog.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style', // No change in behaviour: whitespace, formatting, naming
        'refactor', // No change in behaviour, but the code itself moved
        'perf',
        'test',
        'build', // The build system, or a dependency's version
        'ci',
        'chore', // Touches neither src nor test
        'revert',
      ],
    ],
    // A package's scope is its Nx project name with the `@evanion/` prefix
    // stripped. `nx release` matches a commit scope against project names with a
    // word-boundary regex in which `-` counts as a word character, so the bare
    // name resolves to its own project while a fragment of one -- `widget`
    // against the project `react-widget` -- resolves to nothing, and a commit
    // nx cannot attribute is capped at a patch bump rather than rejected.
    //
    // The list is static: it is read in the commit-msg hook on every commit,
    // where computing the Nx project graph would cost seconds per commit.
    // tools/repo-checks/src/commitlint-scope-enum.test.ts is the other half --
    // it fails the build when a project under nx.json's `release.projects`
    // globs has no entry here.
    'scope-enum': [
      2,
      'always',
      [
        // Nx projects, by bare name. A commit under one of these that also sits
        // under nx.json's `release.projects` globs is what versions a package.
        'astro-widget',
        'compose',
        'docs',
        'feature',
        'luhn',
        'nestjs-correlation-id',
        'nx-astro',
        'react-widget',
        'repo-checks',
        'shop-api',
        'storefront',
        'token',
        'urn',
        // Repository scopes, for work that is not one package's. None of them
        // names a project, so nx attributes such a commit to no package and it
        // can contribute at most a patch bump to whatever files it touched.
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
