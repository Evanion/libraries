import { describe, expect, it } from 'vitest';
import { target } from './redirect.js';

const at = (path) => target(new URL(`https://docs.evanion.com${path}`));

describe('target', () => {
  it('sends a docs page to the same page under /docs', () => {
    expect(at('/acl/errors/')).toBe(
      'https://libs.evanion.com/docs/acl/errors/',
    );
    expect(at('/acl')).toBe('https://libs.evanion.com/docs/acl');
    expect(at('/next/urn/api/')).toBe(
      'https://libs.evanion.com/docs/next/urn/api/',
    );
    expect(at('/urn/getting-started.md')).toBe(
      'https://libs.evanion.com/docs/urn/getting-started.md',
    );
  });
  it('keeps the query', () => {
    expect(at('/urn/?q=1')).toBe('https://libs.evanion.com/docs/urn/?q=1');
    expect(at('/?q=1')).toBe('https://libs.evanion.com/?q=1');
  });
  it('sends the root to the frontpage and the explorer to its root page', () => {
    expect(at('/')).toBe('https://libs.evanion.com/');
    expect(at('/matrix-explorer/')).toBe(
      'https://libs.evanion.com/matrix-explorer/',
    );
    expect(at('/matrix-explorer')).toBe(
      'https://libs.evanion.com/matrix-explorer',
    );
  });
  it('sends assets and site files to the same path at the root', () => {
    expect(at('/sitemap.xml')).toBe('https://libs.evanion.com/sitemap.xml');
    expect(at('/robots.txt')).toBe('https://libs.evanion.com/robots.txt');
    expect(at('/code-classes.css')).toBe(
      'https://libs.evanion.com/code-classes.css',
    );
    expect(at('/_next/static/a.js')).toBe(
      'https://libs.evanion.com/_next/static/a.js',
    );
    expect(at('/_pagefind/pagefind.js')).toBe(
      'https://libs.evanion.com/_pagefind/pagefind.js',
    );
  });
});
