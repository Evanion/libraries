import { describe, expect, it } from 'vitest';
import {
  availabilityLabel,
  availabilityStateClass,
  boxArtPaletteClass,
  boxArtPhotoUrl,
  complexityStop,
  complexityTierName,
  formatComplexity,
  formatPrice,
  gameLadderClass,
  gamesByMechanism,
  mechanismHueClass,
  mechanisms,
  mechanismSlug,
  mechanismToken,
} from './catalogue.js';
import type { Game } from './shop-api.js';

const game = (overrides: Partial<Game> = {}): Game => ({
  urn: 'urn:game:azul',
  title: 'Azul',
  mechanisms: ['tile placement', 'pattern building'],
  players: '2-4',
  playtime: '30-45 min',
  complexity: 1.8,
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

describe('gameLadderClass', () => {
  it('sets a title on the rung its complexity reaches', () => {
    expect(gameLadderClass(game({ complexity: 2.4 }))).toBe('baize-ladder-3');
    expect(gameLadderClass(game({ complexity: 4 }))).toBe('baize-ladder-5');
  });

  it('leaves an unrated title on no rung at all', () => {
    expect(gameLadderClass(game({ complexity: 0 }))).toBeUndefined();
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

describe('boxArtPhotoUrl', () => {
  /**
   * Nothing is photographed yet, and this is what that state has to look like:
   * no URL at all, so no card asks the network for a file that does not exist
   * and the generated vista is what every tile paints.
   */
  it('asks for no file for a title nobody has photographed', () => {
    expect(boxArtPhotoUrl('urn:game:wingspan')).toBeUndefined();
    expect(boxArtPhotoUrl('urn:game:hive')).toBeUndefined();
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

describe('complexity', () => {
  it('shows one decimal against the top of the scale', () => {
    expect(formatComplexity(2.4)).toBe('2.4 / 5');
  });

  it('reaches the stop its tier sits on', () => {
    expect(complexityStop(1.1)).toBe(1);
    expect(complexityStop(1.8)).toBe(2);
    expect(complexityStop(2.4)).toBe(3);
    expect(complexityStop(3.8)).toBe(4);
    expect(complexityStop(4)).toBe(5);
  });

  it('names the tier a shopper reads instead of the number', () => {
    expect(complexityTierName(1.1)).toBe('Gateway');
    expect(complexityTierName(2.4)).toBe('Midweight');
    expect(complexityTierName(4)).toBe('Brain-burner');
  });

  it('never passes the five stops the ramp has', () => {
    expect(complexityStop(9)).toBe(5);
  });

  it('reaches no stop at all for an unrated game', () => {
    expect(complexityStop(0)).toBeUndefined();
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
