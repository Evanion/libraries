/**
 * The registry the Baize listing page renders through.
 *
 * `apps/docs/content/astro-widget` cites the region below by
 * `file=libs/astro-widget/examples/src/registry.ts region=registry`, and the
 * README's examples render pages through it, so what a reader copies off a page
 * is this file.
 *
 * `examples/src` is laid out as the `src` of an Astro project, and it sits
 * outside the package's own `src/`, so `package.json`'s `files` never packs it.
 */
// #region registry
import { defineWidgets } from '@evanion/astro-widget';

import ListingHeader from './widgets/ListingHeader.astro';
import PriceBox from './widgets/PriceBox.astro';

export const registry = defineWidgets({
  'listing-header': ListingHeader,
  'price-box': PriceBox,
});
// #endregion registry
