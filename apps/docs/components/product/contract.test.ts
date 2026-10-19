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
  const path = href
    .replace(/^\/docs\//, '')
    .replace(/#.*$/, '')
    .replace(/\/$/, '');
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
    it('has scenes, each naming a known demo when it has one', () => {
      expect(page.scenes.length).toBeGreaterThan(0);
      const ids = page.scenes.flatMap((s) => (s.demo ? [s.demo.id] : []));
      for (const id of [page.hero.demo, ...ids])
        expect(demos[id]).toBeDefined();
      for (const scene of page.scenes)
        if (scene.demo) expect(scene.demo.caption).toBeTruthy();
    });
    it('gives every scene a why and a how, and a differs only where set', () => {
      for (const scene of page.scenes) {
        expect(scene.why.trim()).toBeTruthy();
        expect(scene.how.trim()).toBeTruthy();
        if ('differs' in scene) expect(scene.differs?.trim()).toBeTruthy();
      }
    });
    it('has an install command, an FAQ and a closing call to action', () => {
      expect(page.hero.install).toMatch(/^npm install /);
      expect(page.faq.length).toBeGreaterThanOrEqual(4);
      for (const entry of page.faq) {
        expect(entry.q.trim()).toBeTruthy();
        expect(entry.a.trim()).toBeTruthy();
      }
      expect(page.closing.title).toBeTruthy();
      expect(page.closing.text).toBeTruthy();
      expect(page.closing.actions.length).toBeGreaterThan(0);
    });
    it('states what it offers and never what other providers lack', () => {
      const text = JSON.stringify(page).toLowerCase();
      for (const phrase of ['compared', 'other tools', 'some flag tools'])
        expect(text).not.toContain(phrase);
    });
    it('says no assignment stored, never that nothing is stored', () => {
      const text = JSON.stringify(page).toLowerCase();
      expect(text).not.toMatch(/nothing (is )?stored/);
    });
    it('links only docs pages that exist', () => {
      const links = [
        ...page.hero.actions,
        ...page.scenes.map((s) => s.howItWorks),
        page.codeSample.link,
        ...page.closing.actions,
        ...page.facts.flatMap((f) => (f.link ? [f.link] : [])),
        ...(page.limits?.items ?? []).flatMap((i) => (i.link ? [i.link] : [])),
      ]
        .map((l) => l.href)
        .filter((h) => h.startsWith('/docs/'));
      expect(links.filter((h) => !resolves(h))).toEqual([]);
    });
    it('gives limits, when present, at least two items and only docs links that exist', () => {
      if (!page.limits) return;
      expect(page.limits.title.trim()).toBeTruthy();
      expect(page.limits.items.length).toBeGreaterThanOrEqual(2);
      for (const item of page.limits.items) {
        expect(item.title.trim()).toBeTruthy();
        expect(item.text.trim()).toBeTruthy();
      }
      const hrefs = page.limits.items.flatMap((i) =>
        i.link ? [i.link.href] : [],
      );
      expect(
        hrefs.filter((h) => h.startsWith('/docs/') && !resolves(h)),
      ).toEqual([]);
    });
    it('shows a code sample from a tested region', () => {
      expect(regionCode(page.codeSample.file, page.codeSample.region)).toMatch(
        /\S/,
      );
    });
  },
);
