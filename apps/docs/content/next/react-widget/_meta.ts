import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/react-widget` in: the model, one region
 * that renders, nested items, checked payloads, the chrome side, Suspense and
 * error boundaries, the demonstration, then the surface.
 *
 * `nesting` and `validation` cover what goes into an item array, from code and
 * from a CMS, and `advanced` covers what wraps the rendered widgets. Each page
 * uses only what the pages above it taught: `validation` checks nested items,
 * so it comes after `nesting`, and `suspense` puts its error boundary inside
 * the item chrome `advanced` introduces. The playground comes after them,
 * because its snippets use chrome and nesting together. The API reference sits
 * last because a reader enters it sideways from a search result, the way
 * `react-acl` orders its own.
 *
 * The labels drop the package name the pages repeat: the section is already
 * called React Widget.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  nesting: 'Nesting Items',
  validation: 'Checking a CMS Payload',
  advanced: 'Chrome, Meta and Ctx',
  suspense: 'Suspense and Error Boundaries',
  playground: 'Playground',
  api: 'API Reference',
} satisfies MetaRecord;
