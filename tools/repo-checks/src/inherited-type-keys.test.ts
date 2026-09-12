import { validateBlocks } from '@evanion/astro-widget';
import { validateItems } from '@evanion/react-widget';
import { describe, expect, it } from 'vitest';

/**
 * `@evanion/astro-widget` and `@evanion/react-widget` each carry their own
 * validator, and this is the contract both owe: a type taken from CMS data is
 * looked up as an own key of the registry, so a name `Object.prototype` carries
 * is unknown rather than registered, and no lookup throws.
 *
 * The two validators are not one shared implementation. The only part they have
 * in common is the own-key predicate; the item shapes, the problem shapes and
 * the rest of the rules differ (ids and `props` on one side, a `required` field
 * map on the other), and the packages publish separately onto two frameworks.
 * Factoring three lines out would cost either a third published package or a
 * React peer in an Astro dependency tree. What actually drifted was the rule,
 * not the structure, so the rule is what is pinned here -- across both packages
 * at once, which no shared module could do for their renderers anyway, one
 * being `.astro` and the other React.
 */
const inheritedKeys = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
];

describe.each(inheritedKeys)('a CMS type of %s', (type) => {
  it('is an unknown block type to @evanion/astro-widget', () => {
    let problems: ReturnType<typeof validateBlocks> = [];
    expect(() => {
      problems = validateBlocks(
        [{ type }],
        { hero: {} },
        { hero: ['heading'] },
      );
    }).not.toThrow();

    expect(problems).toEqual([
      { index: 0, type, message: 'unknown block type' },
    ]);
  });

  it('is an unknown widget type to @evanion/react-widget', () => {
    let problems: ReturnType<typeof validateItems> = [];
    expect(() => {
      problems = validateItems([{ id: 'a', type, props: {} }], {
        hero: () => null,
      });
    }).not.toThrow();

    expect(problems).toEqual([
      { index: 0, id: 'a', type, message: 'unknown widget type' },
    ]);
  });
});

describe('a type the registry actually declares', () => {
  it('is known to @evanion/astro-widget, inherited name or not', () => {
    expect(
      validateBlocks([{ type: 'constructor' }], { constructor: {} }),
    ).toEqual([]);
  });

  it('is known to @evanion/react-widget, inherited name or not', () => {
    expect(
      validateItems([{ id: 'a', type: 'constructor', props: {} }], {
        constructor: () => null,
      }),
    ).toEqual([]);
  });
});
