import { describe, expect, it } from 'vitest';
import { packages } from '../../app/navigation';
import { platformsOf } from './platforms';

/**
 * Every stack the navigation names is one the chip has a colour for.
 *
 * A new package with a new framework word renders, in the browser, as a chip
 * in the fallback colour with nothing said; here it is the name of the word.
 */
describe('the platform chips', () => {
  for (const entry of packages) {
    it(`paint ${entry.slug}'s stack, "${entry.framework}"`, () => {
      expect(platformsOf(entry.framework).length).toBeGreaterThan(0);
    });
  }

  it('refuse a stack word the scale does not carry', () => {
    expect(() => platformsOf('Vue')).toThrow(/not a platform/);
  });
});
