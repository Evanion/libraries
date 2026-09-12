import { describe, expect, it } from 'vitest';
import {
  availabilityColour,
  availabilityLabel,
  formatPrice,
  formatWeight,
  gameHue,
  gamesByMechanism,
  mechanismHue,
  mechanismSlug,
  mechanisms,
  weightSteps,
} from './catalogue.js';
import type { Game } from './shop-api.js';

const game = (overrides: Partial<Game> = {}): Game => ({
  urn: 'urn:game:azul',
  title: 'Azul',
  mechanisms: ['tile placement', 'pattern building'],
  players: '2-4',
  playtime: '30-45 min',
  weight: 1.8,
  price: 34900,
  availability: 'in-stock',
  expansions: [],
  ...overrides,
});

describe('mechanismSlug', () => {
  it('makes a path segment of a mechanism name', () => {
    expect(mechanismSlug('Worker Placement')).toBe('worker-placement');
  });

  it('leaves a hyphen alone, so co-op stays one word', () => {
    expect(mechanismSlug('co-op')).toBe('co-op');
  });
});

describe('mechanismHue', () => {
  it('resolves to the mechanism token with the categorical fallback', () => {
    expect(mechanismHue('engine building')).toBe(
      'var(--mechanism-engine-building, var(--mechanism-default))',
    );
  });

  it('names no colour of its own, so the palette stays in css', () => {
    expect(mechanismHue('dexterity')).not.toMatch(/#|rgb|oklab/);
  });

  it('falls back for a mechanism with no token', () => {
    expect(mechanismHue(undefined)).toBe('var(--mechanism-default)');
  });
});

describe('gameHue', () => {
  it('uses the first mechanism, the one players name the game by', () => {
    expect(gameHue(game({ mechanisms: ['co-op', 'area control'] }))).toBe(
      'var(--mechanism-co-op, var(--mechanism-default))',
    );
  });
});

describe('availability', () => {
  it('labels a state in the words a reader uses', () => {
    expect(availabilityLabel('reprint-pending')).toBe('reprint pending');
  });

  it('resolves a state to its own token, separate from the mechanism hues', () => {
    expect(availabilityColour('out-of-print')).toBe(
      'var(--state-out-of-print)',
    );
  });
});

describe('formatPrice', () => {
  it('formats minor units as whole crowns', () => {
    // A non-breaking space and the currency suffix come from Intl, so the
    // assertion is on the digits rather than on the whole string.
    expect(formatPrice(34900)).toMatch(/349/);
  });
});

describe('weight', () => {
  it('shows one decimal against the top of the scale', () => {
    expect(formatWeight(2.4)).toBe('2.4 / 5');
  });

  it('fills the cell a rating is partway into', () => {
    expect(weightSteps(2.4)).toBe(3);
  });

  it('never fills more than the five cells there are', () => {
    expect(weightSteps(9)).toBe(5);
  });

  it('fills nothing for an unrated game', () => {
    expect(weightSteps(0)).toBe(0);
  });
});

describe('mechanisms', () => {
  it('lists each mechanism once, in catalogue order', () => {
    const list = mechanisms([
      game({ mechanisms: ['co-op', 'legacy'] }),
      game({ mechanisms: ['co-op', 'area control'] }),
    ]);

    expect(list).toEqual(['co-op', 'legacy', 'area control']);
  });
});

describe('gamesByMechanism', () => {
  it('matches a secondary mechanism, not only the first', () => {
    const azul = game();
    const found = gamesByMechanism([azul], 'pattern-building');

    expect(found).toEqual([azul]);
  });

  it('returns nothing for a slug no game carries', () => {
    expect(gamesByMechanism([game()], 'dexterity')).toEqual([]);
  });
});
