import { describe, expect, it } from 'vitest';
import {
  availabilityLabel,
  availabilityStateClass,
  boxArtPaletteClass,
  formatPrice,
  formatWeight,
  gameHueClass,
  gamesByMechanism,
  mechanismHueClass,
  mechanismSlug,
  mechanismToken,
  mechanisms,
  weightStop,
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

describe('mechanismToken', () => {
  it('resolves a catalogue mechanism to its hue family', () => {
    expect(mechanismToken('engine building')).toBe('engineBuilding');
  });

  it('reads co-op as the library spells it', () => {
    expect(mechanismToken('co-op')).toBe('cooperative');
  });

  /**
   * The catalogue's vocabulary is open and the hue scale is not. A mechanism with
   * no family reads as uncategorised rather than borrowing another one's colour.
   */
  it('leaves a mechanism with no family uncategorised', () => {
    expect(mechanismToken('asymmetric powers')).toBe('other');
    expect(mechanismToken(undefined)).toBe('other');
  });
});

describe('mechanismHueClass', () => {
  it("names no colour of its own, because the hue is the stylesheet's", () => {
    expect(mechanismHueClass('worker placement')).toBe(
      'baize-hue-worker-placement',
    );
    expect(mechanismHueClass('dexterity')).not.toMatch(/#|rgb|oklab/);
  });
});

describe('gameHueClass', () => {
  it('uses the first mechanism, the one players name the game by', () => {
    expect(gameHueClass(game({ mechanisms: ['co-op', 'area control'] }))).toBe(
      'baize-hue-cooperative',
    );
  });
});

describe('boxArtPaletteClass', () => {
  /**
   * The palettes are named after pigments, so the mapping is the app's: a reader
   * decodes nothing from a gradient, the same way they decode nothing from a
   * photograph of a box.
   */
  it('paints a mapped game in the palette its box is printed in', () => {
    expect(boxArtPaletteClass('urn:game:azul')).toBe('baize-palette-cobalt');
    expect(boxArtPaletteClass('urn:game:crokinole')).toBe('baize-palette-oak');
  });

  it('leaves a game nobody mapped on the neutral gradient', () => {
    expect(boxArtPaletteClass('urn:game:hive')).toBeUndefined();
  });
});

describe('availability', () => {
  it('labels a state in the words a reader uses', () => {
    expect(availabilityLabel('reprint-pending')).toBe('reprint pending');
  });

  it('resolves a state to its own class, separate from the mechanism hues', () => {
    expect(availabilityStateClass('out-of-print')).toBe(
      'baize-state-out-of-print',
    );
    expect(availabilityStateClass('reprint-pending')).toBe(
      'baize-state-reprint-pending',
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

  it('reaches the stop a rating is partway into', () => {
    expect(weightStop(2.4)).toBe(3);
  });

  it('never passes the five stops the ramp has', () => {
    expect(weightStop(9)).toBe(5);
  });

  it('reaches no stop at all for an unrated game', () => {
    expect(weightStop(0)).toBeUndefined();
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
