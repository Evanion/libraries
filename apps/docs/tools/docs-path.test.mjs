import { describe, expect, it } from 'vitest';
import { DOCS, docsHref, prefixDocsLink } from './docs-path.mjs';

const roots = new Set(['acl', 'urn', 'next', 'testing']);

describe('docsHref', () => {
  it('puts a path under /docs', () => {
    expect(DOCS).toBe('/docs');
    expect(docsHref('')).toBe('/docs/');
    expect(docsHref('acl/errors/')).toBe('/docs/acl/errors/');
    expect(docsHref('/acl/errors/')).toBe('/docs/acl/errors/');
  });
  it('keeps the hash and the query', () => {
    expect(docsHref('/acl/errors/#reasons')).toBe('/docs/acl/errors/#reasons');
    expect(docsHref('/urn/?q=1')).toBe('/docs/urn/?q=1');
  });
  it('leaves a path already under /docs alone', () => {
    expect(docsHref('/docs/acl/')).toBe('/docs/acl/');
    expect(docsHref('/docs')).toBe('/docs');
  });
});

describe('prefixDocsLink', () => {
  it('prefixes a root link into the docs tree', () => {
    expect(prefixDocsLink('/acl/errors/', roots)).toBe('/docs/acl/errors/');
    expect(prefixDocsLink('/next/urn/', roots)).toBe('/docs/next/urn/');
    expect(prefixDocsLink('/urn', roots)).toBe('/docs/urn');
  });
  it('leaves everything else alone', () => {
    for (const href of [
      '/feature-flags/',
      '/_next/static/x.js',
      '/code-classes.css',
      '/',
      'https://example.com/acl/',
      '../rollouts',
      './api',
      '#top',
      '/docs/acl/',
    ])
      expect(prefixDocsLink(href, roots)).toBe(href);
  });
});
