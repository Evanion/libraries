import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demos } from './demos';
import { productJsonLd, productMetadata } from './metadata';
import { regionCode } from './region';
import { products } from './registry';

const DOCS = join(import.meta.dirname, '../..');

/** A docs link resolves when content/next has the page it names. */
function resolves(href: string): boolean {
  const path = href.replace(/^\/docs\//, '').replace(/\/$/, '');
  const [slug, ...rest] = path.split('/');
  const page = rest.join('/') || 'index';
  return existsSync(join(DOCS, 'content', 'next', slug ?? '', `${page}.mdx`));
}

describe.each(products.map((p) => [p.slug, p] as const))(
  'product page %s',
  (_, page) => {
    it('has metadata and structured data', () => {
      expect(productMetadata(page).title).toBeTruthy();
      expect(productJsonLd(page).name).toBe(page.packageName);
    });
    it('states what it is and is not in facts', () => {
      expect(page.facts.length).toBeGreaterThan(0);
      for (const fact of page.facts) {
        expect(fact.title).toBeTruthy();
        expect(fact.text).toBeTruthy();
      }
    });
    it('has scenes, each naming a known demo', () => {
      expect(page.scenes.length).toBeGreaterThan(0);
      for (const id of [page.hero.demo, ...page.scenes.map((s) => s.demo)])
        expect(demos[id]).toBeDefined();
    });
    it('links only docs pages that exist', () => {
      const links = [
        ...page.hero.actions,
        ...page.scenes.map((s) => s.howItWorks),
        page.codeSample.link,
        ...page.next.links,
        ...page.facts.flatMap((f) => (f.link ? [f.link] : [])),
      ]
        .map((l) => l.href)
        .filter((h) => h.startsWith('/docs/'));
      expect(links.filter((h) => !resolves(h))).toEqual([]);
    });
    it('shows a code sample from a tested region', () => {
      expect(regionCode(page.codeSample.file, page.codeSample.region)).toMatch(
        /\S/,
      );
    });
  },
);
