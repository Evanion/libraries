// This package carries no 'use client' and is importable from a React Server
// Component. It uses only what React exports under its `react-server`
// condition -- createElement, Suspense, memo -- and no createContext,
// useContext, Component or stateful hook. `react/package.json` maps that
// condition to `react.react-server.js`, which does not export them at all, so
// reaching for one turns an import into `undefined` at module evaluation.
//
// Neither a bundler nor a jsdom test run resolves that condition, so two
// guards do. `*.server.test.tsx` runs in a vitest project that pins the
// condition, and scripts/verify-packaging.mjs asserts the packed dist/index.js
// carries neither the directive nor a createContext/useContext call.
//
// `./utils.js` is not re-exported: renderWidget and the nesting mechanism are
// internal, so changing them is not a breaking release.

export * from './widget.js';
export * from './widgets.js';
export * from './types.js';

// The item model, re-exported from `@evanion/widget` so that a consumer who
// never names the core never installs it by hand. The same names reach an
// `@evanion/astro-widget` consumer from its own entry point, which is what
// makes an item array authored for one runtime render through the other.
//
// `warnOnce` and `resetWarnings` are deliberately not among them: they are the
// seam the adapters reach the core through, not something a consumer calls.
export {
  defineWidgets,
  validateItems,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from '@evanion/widget';
export type {
  AnyWidgetItem,
  KnownWidgetTypes,
  WidgetMeta,
  WidgetProblem,
  WidgetRegistry,
} from '@evanion/widget';
