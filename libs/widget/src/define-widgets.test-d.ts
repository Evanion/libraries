import { describe, it, expectTypeOf } from 'vitest';
import { defineWidgets } from './define-widgets.js';

const Hero = { name: 'Hero' };
const Text = { name: 'Text' };

describe('defineWidgets types', () => {
  it('keeps the key union in the type', () => {
    const registry = defineWidgets({ hero: Hero, text: Text });
    expectTypeOf(registry).toEqualTypeOf<{
      hero: typeof Hero;
      text: typeof Text;
    }>();
  });
});
