import featureFlags from './pages/feature-flags';
import type { ProductPage } from './types';

/** Every product page, in the order their slugs are listed in `product-slugs.mjs`. */
export const products: readonly ProductPage[] = [featureFlags];

/** The pages that are ready to ship: a draft page is left out of the routes and the links. */
export function published(list: readonly ProductPage[]): ProductPage[] {
  return list.filter((p) => !p.draft);
}

export function productBySlug(slug: string): ProductPage {
  const page = products.find((p) => p.slug === slug);
  if (!page) throw new Error(`No product page has the slug ${slug}`);
  return page;
}

/** The product page for a navigation group, when the group has one. */
export function productForGroup(group: string): ProductPage | undefined {
  return published(products).find((p) => p.group === group);
}
