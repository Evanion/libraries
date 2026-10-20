import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { regionCode } from '../region';
import page from '../pages/authorization';

const REGISTER = join(
  import.meta.dirname,
  '../../../../../libs/acl/SECURITY.md',
);

/** The cells of one register row, trimmed. */
function row(id: string): string[] {
  const line = readFileSync(REGISTER, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`| ${id} `));
  if (!line) throw new Error(`${id} is not in SECURITY.md`);
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

describe('the authorization page', () => {
  it('shows register entries exactly as SECURITY.md states them', () => {
    const entries = page.scenes.flatMap((s) => s.entries ?? []);
    expect(entries.length).toBe(3);
    for (const entry of entries) {
      const [id, attack, cwe, handled] = row(entry.id);
      expect({ id: entry.id, attack: entry.attack, cwe: entry.cwe }).toEqual({
        id,
        attack,
        cwe,
      });
      expect(entry.handled).toBe(handled);
    }
  });

  it('reads the field-level sample from a region that runs', () => {
    const scene = page.scenes.find((s) => s.sample);
    expect(scene?.id).toBe('fields');
    const code = regionCode(scene!.sample!.file, scene!.sample!.region);
    expect(code).toContain('pickAllowedFields(decision, proposed)');
    expect(code).not.toContain('-> ');
  });

  it('keeps the word matrix out of headings and card titles', () => {
    const titles = [
      page.hero.promise,
      page.metadata.title,
      ...page.facts.map((f) => f.title),
      ...page.scenes.map((s) => s.title),
      ...(page.limits?.items.map((i) => i.title) ?? []),
      page.closing.title,
    ];
    expect(titles.filter((t) => /matrix/i.test(t))).toEqual([]);
  });

  it('defines the matrix once, in the hero', () => {
    expect(page.hero.line).toMatch(/JSON document, called the matrix/);
  });

  it('says the server and browser read the same rules, and never that rules cannot drift', () => {
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toMatch(/cannot drift|eliminate/);
    expect(page.facts[0]?.text).toBe(
      'The server and browser read the same rules.',
    );
  });

  it('keeps contract tests as an FAQ entry for several services, not a scene', () => {
    expect(page.scenes.map((s) => s.id)).not.toContain('ci-tests');
    expect(page.faq.some((f) => f.a.includes('contractDrift'))).toBe(true);
  });
});
