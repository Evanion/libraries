import authorization from './pages/authorization';
import featureFlags from './pages/feature-flags';
import rendering from './pages/rendering';
import type { ProductPage } from './types';

/** Every product page, in the order their slugs are listed in `product-slugs.mjs`. */
export const products: readonly ProductPage[] = [
  featureFlags,
  authorization,
  rendering,
];

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

/** The ids of the sections a page renders, which an anchor may name. */
export function sectionIds(page: ProductPage): string[] {
  return [
    ...page.scenes.map((s) => s.id),
    ...(page.codeSample ? [page.codeSample.id] : []),
  ];
}

/**
 * Where a package's product page sends a reader, when its group has a
 * published one: the lead to the page, an adapter to the section that covers
 * it. Undefined when the package is not on a product page.
 */
export function productHref(group: string, name: string): string | undefined {
  const page = productForGroup(group);
  if (!page) return undefined;
  if (name === page.packageName) return `/${page.slug}/`;
  const anchor = page.anchors?.[name];
  return anchor ? `/${page.slug}/#${anchor}` : undefined;
}
