import { describe, expect, it } from 'vitest';

import { EmptyInputError, InvalidDictionaryError } from './exceptions.js';
import { ALTERNATING_CASE_DICTIONARY, DEFAULT_DICTIONARY, Luhn, createLuhn } from './luhn.js';

/**
 * The documented claims that the README cannot make as an executable example.
 *
 * Every `// -> value` in README.md is checked where it is written: those blocks
 * are marked `@import.meta.vitest`, and `tools/doc-examples` turns each claim
 * into an assertion at transform time. What is left here is the rest — the
 * claims that are about throwing, about a fictional dependency, or about a
 * statement too large to carry a value claim on one line.
 *
 * Between them the two halves mean no documented value in this package can be
 * wrong without a test failing.
 */
describe('the documented claims the README cannot assert itself', () => {
  describe('README: quick start', () => {
    /**
     * The block imports `generateRandom` from `some_library`, which stands in
     * for whatever the reader already uses. It cannot run, so the shape it
     * documents is pinned here against a fixed string instead.
     */
    it('appends the check character to the random part', () => {
      const randomString = 'justarandomstringofletters';
      const { checksum } = Luhn.generate(randomString);

      expect(`${randomString}-${checksum}`).toBe(
        'justarandomstringofletters-k',
      );
    });
  });

  describe('README: what the errors are', () => {
    it('generate("") throws EmptyInputError', () => {
      expect(() => Luhn.generate('')).toThrow(EmptyInputError);
    });

    it('an odd dictionary is rejected at construction', () => {
      expect(() => createLuhn({ dictionary: 'abc' })).toThrow(
        InvalidDictionaryError,
      );
    });

    it('a duplicate code point is rejected at construction', () => {
      expect(() => createLuhn({ dictionary: 'aabbccdd' })).toThrow(/repeated/);
    });

    /**
     * The README writes this one as a multi-line `createLuhn({ … })` whose
     * claim is `// throws`. A claim that is not a value, on a statement that
     * is not one line, is outside what the rewriter accepts by design.
     */
    it('folding over a dictionary with case pairs is rejected', () => {
      expect(() =>
        createLuhn({
          dictionary: ALTERNATING_CASE_DICTIONARY,
          caseInsensitive: true,
        }),
      ).toThrow(/case pairs/);
    });
  });

  describe('README: the default instance is frozen', () => {
    it('assignment to the default instance throws', () => {
      expect(() => {
        (Luhn as { dictionary: string }).dictionary = DEFAULT_DICTIONARY;
      }).toThrow(TypeError);
    });

    it('destructuring works', () => {
      const { generate } = Luhn;

      expect(generate('foo').checksum).toBe('5');
    });
  });
});
