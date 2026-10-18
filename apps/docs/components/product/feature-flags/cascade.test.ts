import { describe, expect, it } from 'vitest';
import { cascadeStore, preview, tree } from './cascade';

describe('the cascade scene', () => {
  it('lists exactly the dependants before the switch', () => {
    expect(preview(true)).toEqual(['express-pickup', 'demo-night-booking']);
  });
  it('previews on a copy: the shown store is unchanged by a preview', () => {
    const before = JSON.stringify(cascadeStore(true).resolve());
    preview(true);
    expect(JSON.stringify(cascadeStore(true).resolve())).toBe(before);
  });
  it('turns the branch off with a reason naming the parent', () => {
    const root = tree(false);
    expect(root.on).toBe(false);
    expect(root.children?.[0]).toMatchObject({
      on: false,
      reason: expect.stringContaining('New checkout'),
    });
    expect(root.children?.[0]?.children?.[0]).toMatchObject({ on: false });
    expect(tree(true).children?.[0]?.children?.[0]?.on).toBe(true);
  });
});
