## 0.1.2 (2026-11-07)

### 🚀 Features

- ⚠️  **react-feature:** re-export the 0.2 condition types ([ac261cfa](https://github.com/Evanion/libraries/commit/ac261cfa))

### ⚠️  Breaking Changes

- **react-feature:** re-export the 0.2 condition types  ([ac261cfa](https://github.com/Evanion/libraries/commit/ac261cfa))
  the re-exported `Condition` gains the `exists` and
  `not-exists` ops, so an exhaustive switch over `Condition['op']` stops
  compiling, and `AttributeCondition` and `SerializedAttributeCondition`
  are unions, so code reading `value` narrows on `op` first.
  `ContextSchema.fields` keys are paths, and `RuleOutcome.failed.value` is
  optional.

### 🧱 Updated Dependencies

- Updated @evanion/feature to 0.2.0

### ❤️ Thank You

- Mikael Pettersson @Evanion

## 0.1.1 (2026-11-05)

### 🚀 Features

- **docs:** show a short sample from its own tested region ([68fa945c](https://github.com/Evanion/libraries/commit/68fa945c))

### 📖 Documentation

- **react-feature:** open on the flags living in your repo ([46ee7f90](https://github.com/Evanion/libraries/commit/46ee7f90))
- **repo:** link the documentation at libs.evanion.com/docs ([dc18dbb2](https://github.com/Evanion/libraries/commit/dc18dbb2))
- **react-feature:** open the readme on its family's promise ([66d2eefd](https://github.com/Evanion/libraries/commit/66d2eefd))
- **react-feature:** give the readme gemma's npm landing-page shape ([c7872824](https://github.com/Evanion/libraries/commit/c7872824))

### 🧱 Updated Dependencies

- Updated @evanion/feature to 0.1.1

### ❤️ Thank You

- Mikael Pettersson @Evanion

## 0.1.0 (2026-10-17)

### 🚀 Features

- **react-feature:** re-export the core types its own declarations name ([4a4fef01](https://github.com/Evanion/libraries/commit/4a4fef01))
- **react-feature:** extract the react adapter into its own package ([af19e96a](https://github.com/Evanion/libraries/commit/af19e96a))

### 🩹 Fixes

- **react-feature:** hold the binding back while the core is private ([bce9e235](https://github.com/Evanion/libraries/commit/bce9e235))

### 💅 Refactors

- **react-feature:** call adoptDecisions from the provider ([0bd40d25](https://github.com/Evanion/libraries/commit/0bd40d25))

### 🧱 Updated Dependencies

- Updated @evanion/feature to 0.1.0

### ❤️ Thank You

- Mikael Pettersson @Evanion