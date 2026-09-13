// The framework-free half of a widget region.
//
// Nothing here imports a framework, so this package is usable from a webhook
// handler, a Nest service or a CI script that validates a CMS payload before
// anything renders it. scripts/verify-packaging.mjs greps the packed `dist/`
// for a framework import, because that promise breaks silently: the build
// succeeds and every test passes.
//
// The renderers live one package per framework -- `@evanion/react-widget`,
// `@evanion/astro-widget` -- and each re-exports what its consumers need from
// here, so a consumer who never names this package never installs it by hand.

export * from './types.js';
export * from './constants.js';
export * from './define-widgets.js';
export * from './validate-items.js';
export * from './warn.js';
