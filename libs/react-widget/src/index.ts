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
export * from './constants.js';
export * from './validate-items.js';
