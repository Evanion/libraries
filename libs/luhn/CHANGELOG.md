# 3.0.0 (2026-09-12)

### 🚀 Features

- **repo:** make documented examples executable and sync them to the docs app ([bfb72e9](https://github.com/Evanion/libraries/commit/bfb72e9))

### 💅 Refactors

- ⚠️  **luhn:** validate the dictionary at construction instead of at use ([#85](https://github.com/Evanion/libraries/issues/85), [#86](https://github.com/Evanion/libraries/issues/86), [#87](https://github.com/Evanion/libraries/issues/87), [#88](https://github.com/Evanion/libraries/issues/88), [#89](https://github.com/Evanion/libraries/issues/89), [#90](https://github.com/Evanion/libraries/issues/90), [#91](https://github.com/Evanion/libraries/issues/91), [#94](https://github.com/Evanion/libraries/issues/94))

### ⚠️  Breaking Changes

- **luhn:** validate the dictionary at construction instead of at use  ([#85](https://github.com/Evanion/libraries/issues/85), [#86](https://github.com/Evanion/libraries/issues/86), [#87](https://github.com/Evanion/libraries/issues/87), [#88](https://github.com/Evanion/libraries/issues/88), [#89](https://github.com/Evanion/libraries/issues/89), [#90](https://github.com/Evanion/libraries/issues/90), [#91](https://github.com/Evanion/libraries/issues/91), [#94](https://github.com/Evanion/libraries/issues/94))
  `createLuhn` replaces the class; `Luhn` is now the frozen
  default instance, so `Luhn.dictionary = x` throws instead of being ignored. The
  default dictionary changes from 62 characters to 36, so every check character
  the library has ever emitted changes. The `sensitive` argument and static are
  removed — `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY })` reproduces
  the old case-sensitive values. `ValidationError` is renamed `LuhnError`.
  `validate` requires two surviving code points, `generate` requires one and
  throws `EmptyInputError` otherwise, and both results carry a `filtered` count.
  Closes #85
  Closes #86
  Closes #87
  Closes #88
  Closes #89
  Closes #90
  Closes #91
  Closes #94

### ❤️ Thank You

- Claude Opus 5 (1M context)
- Mikael Pettersson @Evanion