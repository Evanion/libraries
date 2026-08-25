# Changelog

## 2.0.0 (2026-08-26)

First release from the [Evanion/libraries](https://github.com/Evanion/libraries)
monorepo. The library moved here from the standalone `Evanion/compose` repo;
1.0.8 was the last release from there.

### ⚠️ Breaking Changes

- **ESM only.** 1.0.8 shipped dual CJS and ESM builds (`lib/cjs/`, `lib/esm/`).
  This release is ESM only, so `require('@evanion/compose')` no longer works.
  Use an `import`, or stay on 1.0.8.
- **The `Component` type is gone.** It was exported from the package root in
  1.0.8. Use `Provider` or `ProviderArray` instead.
- **`Provider` changed shape** and is now checked against the component it is
  paired with.
- **`ComposeProvider` is a generic function rather than a `React.FC`**, so it can
  infer and check the provider tuple. Assigning it to a plain `React.FC` no
  longer type-checks.
- **Passing no `providers` now throws a `TypeError`** naming the problem,
  instead of failing with "Cannot read properties of undefined".

### 🚀 Features

- Provider props are now genuinely type-checked. A missing prop, a wrong value,
  or a prop the component does not declare is a compile error at the
  `ComposeProvider` call site — which is what the README always claimed.
- `provider()` helper for full IntelliSense on provider props.
- New exports: `ProviderArray`, `ComposeProviderProps`,
  `LegacyComposeProviderProps`, `PropsWithoutChildren`, `ValidateProvider`,
  `ValidateProviders`, `AnyComponent`.
- Development warnings for an empty provider array, the deprecated `components`
  prop, and supplying both props at once.

### 🩹 Fixes

- `process.env.NODE_ENV` was read unguarded and shipped raw into the ESM bundle,
  throwing `ReferenceError: process is not defined` for any consumer loading it
  without a bundler that substitutes `process.env`.
- The provider array was reversed in place, mutating the caller's array.
- Dev warnings fired on every render, and twice per render under StrictMode.
- `dist/test-setup.d.ts` leaked into the published types.

### 📦 Packaging

- Tarball no longer ships tests, tsconfigs or build config.
- Added `repository`, `license`, `engines`, `sideEffects` and a `react` peer
  dependency (`^18 || ^19`).
- Restored `LICENSE` and this changelog, both lost in the move.

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.0.8](https://github.com/Evanion/compose/compare/v1.0.7...v1.0.8) (2023-05-29)

### Bug Fixes

- **type:** proper fix prop when usign tuple ([48a7f64](https://github.com/Evanion/compose/commit/48a7f64826e1d07d1f64ad52ea2a25fed401b5d8))

### [1.0.7](https://github.com/Evanion/compose/compare/v1.0.6...v1.0.7) (2023-05-29)

### Bug Fixes

- **types:** fix required children but correct selection of components/providers ([466720c](https://github.com/Evanion/compose/commit/466720c199a974650c2dbbdbec15948aa7015c23))

### [1.0.6](https://github.com/Evanion/compose/compare/v1.0.5...v1.0.6) (2023-05-29)

### Bug Fixes

- **type:** correct typr for tuples with props ([3456e91](https://github.com/Evanion/compose/commit/3456e911cc72e0ea99c9d5ebfaf408a92049e36d))

### [1.0.5](https://github.com/Evanion/compose/compare/v1.0.4...v1.0.5) (2023-05-20)

### Bug Fixes

- **types:** simplifed and fixed component/provider type to be better compatible ([897babd](https://github.com/Evanion/compose/commit/897babdd8a41b211dd991a5d3c70dc6cc4f4bfd5))

### [1.0.4](https://github.com/Evanion/compose/compare/v1.0.2...v1.0.4) (2023-05-20)

### Bug Fixes

- **props:** code and docs referenced different props ([1777a4a](https://github.com/Evanion/compose/commit/1777a4aaa6f02ce634d41e8b1ad1f4b1c99e27b5))
- **types:** add forwardRef as a valid component type ([543b016](https://github.com/Evanion/compose/commit/543b0164c3f42307e4f86b9965024b90d3fcd7cc))

### [1.0.3](https://github.com/Evanion/compose/compare/v1.0.2...v1.0.3) (2023-05-20)

### Bug Fixes

- **types**: fix component type ([f61995b](https://github.com/Evanion/compose/commit/f61995bcee4f0e373a7059951bebf61935a11e0e)) - Should now properly define the component type for better compatibility.

### Chore

- **package**: update dependencies ([f61995b](https://github.com/Evanion/compose/commit/f61995bcee4f0e373a7059951bebf61935a11e0e)) - Update dependencies to latest version.
