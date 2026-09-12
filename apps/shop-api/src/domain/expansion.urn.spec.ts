import { ValidationError } from '@evanion/urn';
import { describe, expect, it } from 'vitest';
import { ExpansionURN } from './expansion.urn.js';

describe('ExpansionURN', () => {
  it('mints a composite nss from the parent game and the expansion', () => {
    expect(ExpansionURN.forGame('wingspan', 'europe')).toBe(
      'urn:expansion:wingspan:europe',
    );
  });

  it('keeps the composite nss intact through a round trip', () => {
    const urn = ExpansionURN.forGame('wingspan', 'europe');

    expect(ExpansionURN.parse(urn).nss).toBe('wingspan:europe');
    expect(ExpansionURN.stringify(ExpansionURN.parse(urn))).toBe(urn);
  });

  it('reads the parent game urn back out of the composite nss', () => {
    expect(
      ExpansionURN.parentGameUrn(ExpansionURN.forGame('wingspan', 'europe')),
    ).toBe('urn:game:wingspan');
  });

  it('rejects an expansion urn whose nss names no parent game', () => {
    expect(() => ExpansionURN.parentGameUrn('urn:expansion:europe')).toThrow(
      ValidationError,
    );
  });
});
