import { describe, expect, it } from 'vitest';
import { defineWidgets } from './define-widgets.js';
import { validateItems } from './validate-items.js';
import type { AnyWidgetItem } from './types.js';

const Hero = { name: 'Hero' };
const Text = { name: 'Text' };

describe('defineWidgets', () => {
  it('returns the same registry it was given', () => {
    expect(defineWidgets({ hero: Hero, text: Text })).toEqual({
      hero: Hero,
      text: Text,
    });
  });

  it('gives validateItems a registry to check a payload against', () => {
    const registry = defineWidgets({ hero: Hero, text: Text });
    const items: AnyWidgetItem[] = [
      { id: 'a', type: 'hero', props: { heading: 'Hej' } },
    ];

    expect(validateItems(items, registry)).toEqual([]);
  });
});
