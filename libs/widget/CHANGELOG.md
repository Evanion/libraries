# Changelog

## 0.1.0 (2026-08-26)

First published release of `@evanion/react-widget`.

Still 0.x deliberately: the API works and is type-checked, but has not been
exercised by real consumers yet, so it may still move.

### 🚀 Features

- `createWidgets` infers from the component map you give it. An item's `type`
  must be a key of the map, and its `props` are checked against that component,
  so an unknown widget type is a compile error rather than a runtime warning.
- `defineItems` helper, for item arrays declared in a variable — a bare array
  literal widens `type` to `string` and silently loses the check.
- Nested widgets via an injected `<Output />`, to any depth.
- Custom chrome (`wrapper` and `item`), overridable per instance.
- Built-in error boundary and Suspense fallback per widget.

### 🩹 Fixes

- Nesting silently stopped at depth 2 — `Output` never passed an `Output` to
  grandchildren, so the third level was dropped.
- The unknown-type guard used `in`, which walks the prototype chain, so a
  CMS-supplied `type` of `constructor` or `toString` crashed the render instead
  of warning and skipping.
- Nested subtrees remounted on every parent render, discarding child state,
  effects and focus, because a new `Output` component type was built each time.
- Nested widgets ignored instance-level `chrome`.
- `DefaultWrapper` and `DefaultItem` were documented but never exported.

### 📦 Packaging

- Declared a `react` peer dependency (`^18 || ^19`); there was previously no
  dependency information at all.
- Added `LICENSE`, `repository`, `engines` and `sideEffects`.
