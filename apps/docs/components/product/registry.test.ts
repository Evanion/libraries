import { describe, expect, it } from 'vitest';
import { productSlugs } from './product-slugs.mjs';
import {
  productBySlug,
  productForGroup,
  productHref,
  products,
  published,
} from './registry';
import { sectionIds } from './registry';
import { ORIGIN, productJsonLd, productMetadata } from './metadata';

describe('the product registry', () => {
  it('lists the slugs product-slugs.mjs names, in the same order', () => {
    expect(products.map((p) => p.slug)).toEqual(productSlugs);
  });

  it('finds a page by slug and by navigation group', () => {
    expect(productBySlug('feature-flags').packageName).toBe('@evanion/feature');
    expect(productForGroup('feature')?.slug).toBe('feature-flags');
    expect(productForGroup('identifiers')).toBeUndefined();
    expect(productBySlug('rendering').packageName).toBe('@evanion/widget');
    expect(productForGroup('rendering')?.slug).toBe('rendering');
    expect(() => productBySlug('nope')).toThrow(/nope/);
  });
});

describe('anchors', () => {
  it('only name sections the page renders', () => {
    for (const page of products)
      for (const anchor of Object.values(page.anchors ?? {}))
        expect(sectionIds(page)).toContain(anchor);
  });
});

describe('the rendering page links', () => {
  it('sends the core to the page and each renderer to its section', () => {
    expect(productHref('rendering', '@evanion/widget')).toBe('/rendering/');
    expect(productHref('rendering', '@evanion/react-widget')).toBe(
      '/rendering/#react',
    );
    expect(productHref('rendering', '@evanion/astro-widget')).toBe(
      '/rendering/#astro',
    );
  });
});

describe('draft pages', () => {
  it('ships every registered page and hides a draft one', () => {
    expect(products.every((p) => !p.draft)).toBe(true);
    expect(published(products)).toEqual(products);
    const draft = { ...productBySlug('feature-flags'), draft: true };
    expect(published([draft])).toEqual([]);
  });
});

describe('product metadata', () => {
  const page = productBySlug('feature-flags');

  it('names the page, its canonical URL and its Open Graph card', () => {
    const meta = productMetadata(page);
    expect(meta.title).toEqual({
      absolute: `${page.metadata.title} | ${page.packageName}`,
    });
    expect(meta.description).toBe(page.metadata.description);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/feature-flags/`);
    expect(meta.openGraph).toMatchObject({
      title: `${page.metadata.title} | ${page.packageName}`,
      url: `${ORIGIN}/feature-flags/`,
    });
  });

  it('describes the package as SoftwareSourceCode', () => {
    expect(productJsonLd(page)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: '@evanion/feature',
      codeRepository:
        'https://github.com/Evanion/libraries/tree/main/libs/feature',
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
    });
  });
});
