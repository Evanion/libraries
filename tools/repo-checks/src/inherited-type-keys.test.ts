import { validateItems as validateFromAstro } from '@evanion/astro-widget';
import { validateItems as validateFromReact } from '@evanion/react-widget';
import { validateItems as validateFromCore } from '@evanion/widget';
import { describe, expect, it } from 'vitest';

/**
 * A type taken from CMS data is looked up as an own key of the registry, so a
 * name `Object.prototype` carries is unknown rather than registered, and no
 * lookup throws.
 *
 * There is one implementation of that rule now, in `@evanion/widget`, and its
 * own suite covers it. What this file pins is that the rule is what each
 * adapter's public surface actually exposes: the packages publish separately
 * onto two frameworks, and an adapter that stopped re-exporting the core's
 * validator -- or re-exported something else under the name -- would put the
 * rule back to being a per-package promise. That is the shape the same
 * prototype-chain bug was fixed twice in.
 */
const validators = {
  '@evanion/widget': validateFromCore,
  '@evanion/react-widget': validateFromReact,
  '@evanion/astro-widget': validateFromAstro,
};

const inheritedKeys = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
];

describe.each(Object.entries(validators))('%s', (_name, validate) => {
  it('exposes the one validator, not a copy of it', () => {
    expect(validate).toBe(validateFromCore);
  });

  it.each(inheritedKeys)('reports a CMS type of %s as unknown', (type) => {
    let problems: ReturnType<typeof validate> = [];
    expect(() => {
      problems = validate(
        [{ id: 'a', type, props: {} }],
        { hero: {} },
        {
          hero: ['heading'],
        },
      );
    }).not.toThrow();

    expect(problems).toEqual([
      { index: 0, id: 'a', type, message: 'unknown widget type' },
    ]);
  });

  it('accepts an inherited name the registry actually declares', () => {
    expect(
      validate([{ id: 'a', type: 'constructor', props: {} }], {
        constructor: {},
      }),
    ).toEqual([]);
  });
});
