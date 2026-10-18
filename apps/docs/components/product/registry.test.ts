import { describe, expect, it } from 'vitest';
import { productSlugs } from './product-slugs.mjs';
import { productBySlug, productForGroup, products } from './registry';
import { ORIGIN, productJsonLd, productMetadata } from './metadata';

describe('the product registry', () => {
  it('lists the slugs product-slugs.mjs names, in the same order', () => {
    expect(products.map((p) => p.slug)).toEqual(productSlugs);
  });

  it('finds a page by slug and by navigation group', () => {
    expect(productBySlug('feature-flags').packageName).toBe('@evanion/feature');
    expect(productForGroup('feature')?.slug).toBe('feature-flags');
    expect(productForGroup('identifiers')).toBeUndefined();
    expect(() => productBySlug('nope')).toThrow(/nope/);
  });
});

describe('product metadata', () => {
  const page = productBySlug('feature-flags');

  it('names the page, its canonical URL and its Open Graph card', () => {
    const meta = productMetadata(page);
    expect(meta.title).toBe(page.metadata.title);
    expect(meta.description).toBe(page.metadata.description);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/feature-flags/`);
    expect(meta.openGraph).toMatchObject({
      title: page.metadata.title,
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
