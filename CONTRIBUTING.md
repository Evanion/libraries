# Contributing

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to ensure a clear and consistent commit history.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scopes

A scope for a package must be that package's Nx project name with the
`@evanion/` prefix stripped -- nothing else. Nx matches commit scopes against
project names literally, so `widget` does **not** match the project
`react-widget`; a mismatched scope is attributed to no project at all and the
commit is silently downgraded to a `patch` bump. Nothing errors, you just get
the wrong version, and published versions cannot be taken back. Run
`npx nx show projects` if you are unsure of a name.

Package scopes:

- **compose**: Changes to the `@evanion/compose` library
- **urn**: Changes to the `@evanion/urn` library
- **luhn**: Changes to the `@evanion/luhn` library
- **react-widget**: Changes to the `@evanion/react-widget` library
- **astro-widget**: Changes to the `@evanion/astro-widget` library
- **nestjs-correlation-id**: Changes to the `@evanion/nestjs-correlation-id` library
- **docs**: Changes to the docs app
- **storefront**: Changes to the storefront demo app
- **shop-api**: Changes to the shop-api demo app
- **nx-astro**: Changes to the local Nx Astro plugin

Repository scopes (these are not projects and never bump a package on their
own):

- **deps** / **deps-dev**: Changes to dependencies
- **nx**: Changes to Nx configuration
- **ci**: Changes to CI workflows
- **repo**: Repository-wide chores
- **release** / **releasing**: Release tooling and the release runbook
- **specs**: Changes under `docs/specs`
- **libs**: Cross-cutting changes to every library
- **types**: Cross-cutting type changes
- **packaging**: Package metadata and publishing config
- **prettier**: Formatting configuration
- **repo-checks**: Changes to the workspace-invariant tests

The list is enforced. `commitlint.config.js` carries it as the `scope-enum`
rule, and the commit-msg hook rejects anything outside it. It is a static list
on purpose -- computing the Nx project graph on every commit would make the
hook unusably slow -- so a test in `tools/repo-checks` fails the build if a new
releasable project is added without a matching entry.

Scopes drive the per-package changelogs, so keep library changes scoped to the
library they touch.

### Version Bumps

Not every type bumps a version. Nx's conventional-commits config
(`node_modules/nx/dist/src/command-line/release/config/conventional-commits.js`)
maps each type to a `semverBump`:

- **feat** -- minor
- **fix** -- patch
- Everything else (**perf**, **refactor**, **docs**, **build**, **types**,
  **chore**, **examples**, **test**, **style**, **ci**, **revert**) -- none

Only `feat` and `fix` move a version. A `perf` or `refactor` commit still
shows up in the changelog; it just bumps nothing.

This compounds with the scope rule above in the worst possible way. A `fix`
whose scope isn't a project name isn't rejected and isn't ignored -- Nx falls
back to attributing it by the files it touched, and an infrastructure commit
almost always touches root files (`package.json`, workflow configs,
`nx.json`). Root files belong to every package, so the patch bump lands on
all of them, not none of them. `fix(release): stop the version step
publishing` is the commit that did this: `release` matches no project, so a
one-line release-tooling fix now wants to patch-bump four unrelated packages.

Use `ci` or `chore` for workflow, tooling and repo-config changes, never
`fix`, unless the change is actually scoped to one package.

### Examples

```bash
feat(react-widget): add error boundary support
fix(react-widget): resolve type issues in renderWidget function
docs: update README with new API examples
test(react-widget): add performance tests for large widget sets
chore: update dependencies to latest versions
```

### Using Commitizen

To make commits easier, use the interactive commit tool:

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

### A note on `typecheck` and `check`

`nx run-many -t typecheck` covers the libraries. The docs app has no separate
`typecheck` target -- `next build` already runs "Checking validity of types",
so it is covered by `build`. `@nx/next/plugin` does not support a
`typecheckTargetName` option, so adding one has no effect.

`storefront` is the opposite case, and the trap is that it looks fine.
Nx infers a `typecheck` target from `tsconfig.json`, but **disables** it --
swapping the command for an `echo` -- whenever the resolved config sets
`noEmit: true`, because `tsc --build` cannot run that way. Astro's shared
config (`astro/tsconfigs/base.json`) sets exactly that, so the target passes
without checking anything, and `astro build` does not typecheck either. Use
`astro check`, which Nx infers as a `check` target. CI and the release
verification both run `lint test build typecheck check` for this reason.

Note also that Nx caches parsed tsconfigs on disk. If `node_modules` changes in
a way that alters how an `extends` chain resolves, that cache can go stale and
Nx will infer the wrong command until you run `nx reset`.

### Pre-commit Hooks

This project uses Husky pre-commit hooks that run **only on affected projects** using Nx:

- **Linting**: Automatically runs `nx affected --target=lint` on changed projects
- **Efficiency**: Only lints projects that have been modified, not the entire repository
- **Parallel**: Runs up to 3 projects in parallel for faster execution

### Commit Linting

All commit messages are automatically linted using commitlint. If your commit message doesn't follow the convention, the commit will be rejected with helpful error messages.

### Optional: Full Pre-commit with Tests

If you want to run tests on affected projects as well, you can use:

```bash
# Replace the pre-commit hook temporarily
cp .husky/pre-commit-with-tests .husky/pre-commit
```

### Breaking Changes

Version bumps are inferred from these commits, so a breaking change **must**
carry a `BREAKING CHANGE:` footer — describing it in prose is not enough and
results in a minor bump for a breaking release. See [RELEASING.md](./RELEASING.md).

If your commit introduces a breaking change, add `BREAKING CHANGE:` to the footer:

```
feat(widget): change Output component API

BREAKING CHANGE: Output component now requires items prop instead of children
```

### Issues

Reference issues in your commit message footer:

```
fix(widget): resolve memory leak in nested widgets

Closes #123
Fixes #456
```
