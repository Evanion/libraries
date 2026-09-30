/**
 * The build gate for the Baize listing page, run as
 * `npx tsx scripts/check-content.ts && astro build`.
 *
 * `apps/docs/content/next/astro-widget/validation.mdx` cites the region below, and
 * the README's validation section imports this file, so the import throwing is
 * the test that the listing page's items pass.
 *
 * `known` lists the type names because this script runs under plain Node,
 * which cannot import the `.astro` modules the registry holds.
 */
// #region build-gate
import { validateItems } from '@evanion/astro-widget';

import { items } from '../src/data/brass-birmingham';

const known = ['listing-header', 'price-box'];
const required = { 'listing-header': ['title'], 'price-box': ['price'] };

const report = validateItems(items, known, required).map(
  (problem) =>
    `item ${problem.index} (${problem.id}, ${problem.type}): ${problem.message}`,
);

if (report.length > 0) throw new Error(report.join('\n'));
// #endregion build-gate
