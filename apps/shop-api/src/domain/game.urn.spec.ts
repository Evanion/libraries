import { describe, expect, it } from 'vitest';
import { GameURN } from './game.urn.js';

describe('GameURN', () => {
  it('stringifies an id under the game namespace', () => {
    expect(GameURN.stringify('wingspan')).toBe('urn:game:wingspan');
  });

  it('parses the id back out under its own namespace', () => {
    expect(GameURN.parse('urn:game:wingspan').nss).toBe('wingspan');
  });
});
