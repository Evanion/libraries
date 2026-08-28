'use client';

// This library cannot exist without createContext/useContext/Component, none of
// which React exposes under its `react-server` condition -- so it must run in the
// client graph. Without this directive, importing it from a Next.js App Router
// page (a Server Component by default) fails at module evaluation with an opaque
// "Named export 'useContext' not found".
//
// Verified that rolldown preserves this directive into dist/index.js, so no
// build-time banner is needed. scripts/verify-packaging.mjs asserts it is still
// there in the packed tarball, since losing it breaks the package silently --
// it would still build and still pass every test.

export * from './widget.js';
export * from './widgets.js';
export * from './types.js';
export * from './constants.js';
export * from './utils.js';
