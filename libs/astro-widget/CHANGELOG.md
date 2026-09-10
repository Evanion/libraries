## 0.2.0 (2026-09-10)

### 🩹 Fixes

- ⚠️  **astro-widget:** report validation problems in english ([e51907c](https://github.com/Evanion/libraries/commit/e51907c))
- ⚠️  **astro-widget:** keep placement data out of block props ([2378269](https://github.com/Evanion/libraries/commit/2378269))

### ⚠️  Breaking Changes

- **astro-widget:** report validation problems in english  ([e51907c](https://github.com/Evanion/libraries/commit/e51907c))
  BlockProblem.message strings changed. A caller matching on the
  old text must match "unknown block type", "missing field <name>" and "blocks is
  not a list" instead.
- **astro-widget:** keep placement data out of block props  ([2378269](https://github.com/Evanion/libraries/commit/2378269))
  a block that read placement data out of its own props must now
  read it from `meta` on the item chrome instead.
  Part of #71

### ❤️ Thank You

- Claude Opus 5 (1M context)
- Mikael Pettersson @Evanion

## 0.1.0 (2026-08-30)

### 🚀 Features

- **astro-widget:** Add Widgets renderer ([e10b840](https://github.com/Evanion/libraries/commit/e10b840))
- **astro-widget:** Add validateBlocks ([8280820](https://github.com/Evanion/libraries/commit/8280820))
- **astro-widget:** Add block types and defineBlocks ([8cceba9](https://github.com/Evanion/libraries/commit/8cceba9))

### 🩹 Fixes

- **astro-widget:** Fix six pre-publish packaging and packaging-adjacent findings ([09be4c2](https://github.com/Evanion/libraries/commit/09be4c2))
- **astro-widget:** Correct children and chrome.item docs ([5ffd5e6](https://github.com/Evanion/libraries/commit/5ffd5e6))
- **astro-widget:** Move key-union assertion into a type-checked test-d file ([1e300d2](https://github.com/Evanion/libraries/commit/1e300d2))

### ❤️ Thank You

- Mikael Pettersson @Evanion