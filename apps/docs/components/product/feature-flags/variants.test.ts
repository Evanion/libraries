import { describe, expect, it } from 'vitest';
import { assign, moved, variantStore, visitors } from './variants';

describe('the variants scene', () => {
  it('moves only visitors at the boundary when the split changes', () => {
    const a = assign(30, false);
    const b = assign(50, false);
    for (const id of moved(a, b)) expect(a[id]).toBe('control');
    for (const id of moved(a, b)) expect(b[id]).toBe('blue');
    expect(moved(a, b).length).toBeLessThan(visitors.length);
  });
  it('the same visitor keeps their variant at the same split', () => {
    expect(assign(40, false)).toEqual(assign(40, false));
  });
  it('pins booksellers to blue without switching the feature off for anyone', () => {
    const pinned = assign(0, true);
    for (const v of visitors)
      if (v.bookseller) expect(pinned[v.id]).toBe('blue');
    const decisions = visitors.map(
      (v) =>
        variantStore(0, true).resolve({
          targetingKey: v.id,
          role: v.bookseller ? 'bookseller' : 'customer',
        })['checkout-cta'],
    );
    expect(decisions.every((d) => d.enabled)).toBe(true);
  });
});
