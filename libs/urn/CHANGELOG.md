# Changelog

## 2.0.0 (2026-08-26)

First release from the [Evanion/libraries](https://github.com/Evanion/libraries)
monorepo. The library moved here from the standalone `Evanion/urn` repo; 1.1.1
was the last release from there.

### ⚠️ Breaking Changes

- **ESM only.** 1.1.1 shipped dual builds (`build/main/`, `build/module/`). This
  release is ESM only, so `require('@evanion/urn')` no longer works.
- **`parse` now throws `ValidationError` on malformed input.** It previously
  never threw, and returned corrupt values instead — `URN.parse('foo')` gave
  back `{ urn: 'foo', nid: undefined, nss: 'undefined:' }`.
- **`parse` no longer takes type parameters.** It declared three that nothing
  verified, letting a caller assert a shape the runtime never guaranteed.
- **`stringify` validates the NSS**, which it previously did not. Input that
  used to pass may now throw.
- **Empty components are rejected.** `isValid` required zero or more characters,
  so `URN.stringify('')` returned `'urn:nid:'` — a value `isValidFormat` itself
  rejects. It now requires at least one character.
- **`InvalidError`'s constructor signature changed** from `(property)` to
  `(property, value, invalidChar?)`, and its messages changed with it.
- **`extractId` throws `ValidationError`** rather than a bare `Error`.
- **`belongsToNamespace` defaults `expectedUrn` to the class's own scheme**
  rather than the literal `'urn'`.
- **`IBasicURN` removed.** It was an exact alias of `IFullURN`.
- **`ParsedURN` is no longer generic.**

### 🚀 Features

- New: `isValidFormat`, `extractId`, `sameNamespace`, `belongsToNamespace`.
- `ValidationError` base class, so one `catch` handles every failure.
- `InvalidError` carries `property`, `value` and `invalidChar`.
- The permitted character set now includes `.` and `~` alongside
  `a-z`, `0-9`, `-`, `_` and `:`.

### 🩹 Fixes

- `sameNamespace` returned `true` for two identical malformed strings, because
  both parsed to `nid: undefined` and compared equal.
- `belongsToNamespace` returned `false` for every subclass, since it compared
  against a hardcoded `'urn'`.
- `parse` joined a retained foreign NID with a hardcoded `':'` instead of the
  class's `separator`.
- Subclasses no longer need `(Subclass as typeof URN)` to call inherited
  statics, so the documented examples now type-check as written.

### 📦 Packaging

- `private: true` removed — the package was marked private while being published.
- Tarball no longer ships spec files or 33kB of TypeScript build state.
- Added `repository`, `engines` and `sideEffects`.

## 1.1.0 (2022-05-27)

### Features

- **urn:** a first implementation of the class ([ae57856](https://github.com/Evanion/urn/commit/ae5785699ba769e5694843bc75e47b320cd9343d))

### Bug Fixes

- **stringify:** avoid duplication of NID ([f0a52f4](https://github.com/Evanion/urn/commit/f0a52f41756064589f1ed2a20eac3358bd178dfa))
