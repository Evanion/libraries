import { describe, expect, it } from 'vitest';
import { explain, people, actions } from './explain';

describe('the explain scene', () => {
  it('names the rule that said yes', () => {
    const answer = explain({
      person: 'seller',
      action: 'edit',
      status: 'draft',
      rowLoaded: true,
    });
    expect(answer.decision).toMatchObject({
      allowed: true,
      reason: 'allow',
      rule: 'seller-edits-own',
    });
    expect(answer.headline).toBe('Allowed');
    expect(answer.detail).toContain('seller-edits-own');
  });

  it('names the deny rule that beats an allow', () => {
    const answer = explain({
      person: 'owner',
      action: 'edit',
      status: 'published',
      rowLoaded: true,
    });
    expect(answer.decision).toMatchObject({
      allowed: false,
      reason: 'denied',
      rule: 'published-is-locked',
    });
    expect(answer.headline).toBe('Refused');
    expect(answer.detail).toContain('published-is-locked');
  });

  it('says plainly when no rule says yes', () => {
    const answer = explain({
      person: 'customer',
      action: 'publish',
      status: 'draft',
      rowLoaded: true,
    });
    expect(answer.decision).toMatchObject({
      allowed: false,
      reason: 'no-rule-matched',
    });
    expect(answer.detail).toMatch(/no rule/i);
  });

  it('cannot tell until the row is loaded, and says what to fetch', () => {
    const answer = explain({
      person: 'seller',
      action: 'edit',
      status: 'draft',
      rowLoaded: false,
    });
    expect(answer.decision).toMatchObject({
      allowed: false,
      reason: 'unevaluable',
    });
    expect(answer.headline).toBe('Cannot tell yet');
    expect(answer.fetch).toEqual(['object.status', 'object.sellerId']);
    expect(answer.detail).toContain('object.status');
    expect(answer.detail).toContain('published-is-locked needs the row');
    expect(answer.ruleNeedsRow).toBe(true);
  });

  it('opens the verdict sentence with a capital letter', () => {
    for (const person of ['customer', 'seller', 'owner'] as const) {
      const answer = explain({
        person,
        action: 'edit',
        status: 'draft',
        rowLoaded: true,
      });
      expect(answer.sentence).toMatch(/^[A-Z]/);
      expect(answer.sentence).toContain('edit this listing');
    }
  });

  it('decides an action that reads no row without loading one', () => {
    const answer = explain({
      person: 'customer',
      action: 'read',
      status: 'draft',
      rowLoaded: false,
    });
    expect(answer.decision.allowed).toBe(true);
    expect(answer.fetch).toEqual([]);
  });

  it('settles after the fetch', () => {
    const before = explain({
      person: 'seller',
      action: 'edit',
      status: 'draft',
      rowLoaded: false,
    });
    const after = explain({
      person: 'seller',
      action: 'edit',
      status: 'draft',
      rowLoaded: true,
    });
    expect(before.decision.allowed).toBe(false);
    expect(after.decision.allowed).toBe(true);
  });

  it('lists three people and three actions', () => {
    expect(Object.keys(people)).toEqual(['customer', 'seller', 'owner']);
    expect(actions.map((a) => a.id)).toEqual(['read', 'edit', 'publish']);
  });
});
