# Changelog

## 2.0.0 (2026-08-27)

First release from the [Evanion/libraries](https://github.com/Evanion/libraries)
monorepo. The library moved here from the standalone
`Evanion/nestjs-correlation-id` repo; 1.1.0 was the last release from there.

### ⚠️ Breaking Changes

- **NestJS 6 through 9 are no longer supported.** The peer range is now
  `^10 || ^11 || ^12`. Those majors are long past end of life, and claiming
  support for versions that are never tested is worse than declaring the range
  honestly.
- **An `exports` map was added.** Deep imports into `dist/` no longer resolve.
  They were never a documented entry point.
- **`uuid` is no longer a dependency.** Ids now come from `node:crypto`'s
  `randomUUID`, which has been built into every supported Node version. The
  generated format is unchanged (RFC 4122 v4), and a custom `generator` is
  unaffected. This library now has no runtime dependencies beyond `tslib`.
- **Node 20 or newer is required**, declared via `engines`.

### 🚀 Features

- **Ships both ESM and CommonJS.** NestJS 12 is ESM-only while 10 and 11 are
  CommonJS, so both formats are needed to cover the supported range. `import`
  and `require()` both work, and both are verified against a packed tarball on
  every release.
- **NestJS 12 support.**
- **`CorrelationConfig` is now exported** from the package root. It is the type
  `CorrelationModule.forRoot()` takes, and it was never exported — so callers
  could configure the module without being able to name the type.
- **`@nestjs/axios` is now an optional peer dependency.** It is only used for a
  type in `withCorrelation`, and the import is type-only, so it is erased at
  runtime. Consumers that do not use `withCorrelation` no longer need it
  installed.

### 🩹 Fixes

- **The `@nestjs/axios` peer range was malformed and matched nothing.** It read
  `^0.1.0 || ^1.0.0 || ^2.0.0 || ^3.00` — that `^3.00` is not valid semver, and
  one invalid comparator invalidates the _entire_ range, so even the `^2.0.0`
  entry failed to match. This is why
  [#1 "Add support for @nestjs/axios 2x"](https://github.com/Evanion/nestjs-correlation-id/issues/1)
  stayed broken after 2.x was ostensibly added: a single missing zero.
- The README imported from `@nestjs-common` rather than `@nestjs/common`.

### 🏗️ Internal

- Tests migrated from jest to vitest, and expanded from 5 to 12.
- Releases now go through `nx release` with npm trusted publishing and
  provenance, replacing release-it.

## 1.0.0

- Initial release

> Releases 1.0.3 through 1.1.0 were published from the standalone repository
> without changelog entries. See the
> [commit history](https://github.com/Evanion/nestjs-correlation-id/commits/main)
> there for what changed.
