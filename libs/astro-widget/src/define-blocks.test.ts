import { describe, expect, it, expectTypeOf } from 'vitest';
import { defineBlocks } from './define-blocks';
import type { BlockItem } from './types';

const Hero = { name: 'Hero' };
const Text = { name: 'Text' };

describe('defineBlocks', () => {
  it('returns the same map it was given', () => {
    const registry = defineBlocks({ hero: Hero, text: Text });
    expect(registry).toEqual({ hero: Hero, text: Text });
  });

  it('keeps the key union in the type', () => {
    const registry = defineBlocks({ hero: Hero, text: Text });
    expectTypeOf(registry).toHaveProperty('hero');
    expectTypeOf(registry).toHaveProperty('text');
  });

  it('accepts a block item with arbitrary props', () => {
    const item: BlockItem = { type: 'hero', id: 'a', rubrik: 'Hej', kolumner: 3 };
    expect(item.type).toBe('hero');
  });
});
