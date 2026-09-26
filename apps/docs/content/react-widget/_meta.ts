import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/react-widget` in: the model, one region
 * that renders, the items side, the chrome side, the demonstration, then the
 * surface.
 *
 * `examples` covers what a reader writes into an item array and `advanced`
 * covers what wraps the rendered widgets, and each page uses only what the
 * pages above it taught. The playground comes after both, because its snippets
 * use chrome and nesting together. The API reference sits last because a reader
 * enters it sideways from a search result, the way `react-acl` orders its own.
 *
 * The labels drop the package name the pages repeat: the section is already
 * called React Widget.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  examples: 'Writing and Checking Items',
  advanced: 'Chrome, Meta, Ctx and Suspense',
  playground: 'Playground',
  api: 'API Reference',
} satisfies MetaRecord;
