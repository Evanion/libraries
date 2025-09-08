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

- **widget**: Changes to the widget library
- **docs**: Changes to documentation
- **nx**: Changes to Nx configuration
- **deps**: Changes to dependencies

### Examples

```bash
feat(widget): add error boundary support
fix(widget): resolve type issues in renderWidget function
docs: update README with new API examples
test(widget): add performance tests for large widget sets
chore: update dependencies to latest versions
```

### Using Commitizen

To make commits easier, use the interactive commit tool:

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

### Commit Linting

All commit messages are automatically linted using commitlint. If your commit message doesn't follow the convention, the commit will be rejected with helpful error messages.

### Breaking Changes

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
