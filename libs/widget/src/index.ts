// No 'use client'. This package is deliberately importable from a React Server
// Component: it uses only exports React provides under its `react-server`
// condition -- createElement, Suspense, memo -- and no createContext,
// useContext, Component or stateful hook.
//
// That is easy to lose silently, so two guards exist. `*.server.test.tsx` runs
// in a vitest project that resolves react under the `react-server` condition,
// and scripts/verify-packaging.mjs asserts the packed dist/index.js carries
// neither the directive nor a createContext/useContext call.
//
// `./utils.js` is not re-exported: renderWidget and the nesting mechanism are
// internal, so changing them is not a breaking release.

export * from './widget.js';
export * from './widgets.js';
export * from './types.js';
export * from './constants.js';
export * from './validate-items.js';
