import { describe, it, expectTypeOf } from 'vitest';
import { defineBlocks } from './define-blocks';

const Hero = { name: 'Hero' };
const Text = { name: 'Text' };

describe('defineBlocks types', () => {
  it('keeps the key union in the type', () => {
    const registry = defineBlocks({ hero: Hero, text: Text });
    expectTypeOf(registry).toEqualTypeOf<{ hero: typeof Hero; text: typeof Text }>();
  });
});
