import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { indexedPaths, writeSitemap } from './sitemap.mjs';

/**
 * The invariant: the sitemap lists every page a search engine should index and
 * no page that asks not to be indexed.
 *
 * Against a fixture export, because the real one is only there after a build.
 */

const exports = [];

afterAll(() => {
  for (const out of exports) rmSync(out, { recursive: true, force: true });
});

const page = (robots) =>
  `<!doctype html><html><head>${robots ? `<meta name="robots" content="${robots}"/>` : ''}<title>x</title></head><body></body></html>`;

function fixture(files) {
  const out = mkdtempSync(join(tmpdir(), 'docs-sitemap-'));
  exports.push(out);

  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), contents);
  }

  return out;
}

describe('the sitemap', () => {
  const out = fixture({
    'index.html': page(),
    CNAME: 'docs.evanion.com\n',
    'urn/index.html': page(),
    'urn/api/index.html': page(),
    'urn/v1/index.html': page('noindex, follow'),
    'next/urn/index.html': page('noindex, follow'),
    'urn/components/index.html': page('noindex'),
    '404/index.html': page('noindex'),
    '_next/static/index.html': page(),
    'urn/api.md': '# API',
  });

  it('lists the released pages and the landing page', () => {
    expect(indexedPaths(out)).toEqual(['/', '/urn/', '/urn/api/']);
  });

  it('names the pages on the custom domain, and robots.txt names it', () => {
    writeSitemap(out);

    expect(readFileSync(join(out, 'sitemap.xml'), 'utf8')).toContain(
      '<loc>https://docs.evanion.com/urn/api/</loc>',
    );
    expect(readFileSync(join(out, 'robots.txt'), 'utf8')).toContain(
      'Sitemap: https://docs.evanion.com/sitemap.xml',
    );
  });
});
