import { describe, expect, it } from 'vitest';
import {
  availabilityCounts,
  availabilityOf,
  buildShelf,
  shelfTotals,
} from '../app/shelf.js';
import {
  mechanism as mechanismHues,
  weight as weightRamp,
} from '@evanion/baize-ui/tokens';
import {
  availabilityToken,
  mechanismToken,
  weightStop,
} from '../app/ui/catalogue.js';
import type { Game, Stock } from '../app/shop-api.server.js';

const games: Game[] = [
  {
    urn: 'urn:game:wingspan',
    title: 'Wingspan',
    mechanisms: ['engine building'],
    players: '1-5',
    playtime: '40-70 min',
    weight: 2.4,
  },
  {
    urn: 'urn:game:brass-birmingham',
    title: 'Brass: Birmingham',
    mechanisms: ['network building'],
    players: '2-4',
    playtime: '60-120 min',
    weight: 3.9,
  },
];

const stock: Stock[] = [{ urn: 'urn:game:wingspan', quantity: 12 }];

describe('availabilityOf', () => {
  it('prefers a declared state over what stock implies', () => {
    expect(
      availabilityOf('urn:game:azul', 25, { 'urn:game:azul': 'preorder' }),
    ).toBe('preorder');
  });

  it('derives from stock when nothing is declared', () => {
    expect(availabilityOf('urn:game:azul', 25, {})).toBe('in stock');
    expect(availabilityOf('urn:game:azul', 0, {})).toBe('preorder');
  });
});

describe('buildShelf', () => {
  const rows = buildShelf(games, stock, {
    'urn:game:brass-birmingham': 'reprint pending',
  });

  it('carries a title with no stock record at zero rather than dropping it', () => {
    expect(rows).toHaveLength(2);
    expect(rows[1]?.quantity).toBe(0);
  });

  it('marks a row whose state a merchant set', () => {
    expect(rows[0]?.declared).toBe(false);
    expect(rows[1]).toMatchObject({
      availability: 'reprint pending',
      declared: true,
    });
  });

  it('totals the shelf', () => {
    expect(shelfTotals(rows)).toEqual({
      titles: 2,
      unitsOnHand: 12,
      emptyShelves: 1,
      meanWeight: 3.15,
    });
  });

  it('reports every availability state, including the empty ones', () => {
    expect(availabilityCounts(rows)).toEqual([
      { state: 'in stock', titles: 1 },
      { state: 'preorder', titles: 0 },
      { state: 'reprint pending', titles: 1 },
      { state: 'out of print', titles: 0 },
    ]);
  });
});

/**
 * The three channels the shelf hands to `@evanion/baize-ui`.
 *
 * The claim the previous version of this file made -- that a mechanism gets the
 * same hue in any app -- was not true: the hue came from a hash of the name, and
 * the storefront hashed into a different palette for the same game. A table
 * against the library's own enum is what makes it true.
 */
describe('the channels the shelf maps onto', () => {
  it('resolves a mechanism to a family the library declares', () => {
    expect(mechanismToken('engine building')).toBe('engineBuilding');
    expect(mechanismToken('Engine Building')).toBe('engineBuilding');
    expect(Object.keys(mechanismHues)).toContain(mechanismToken('dexterity'));
  });

  it('leaves a mechanism outside the scale uncategorised', () => {
    expect(mechanismToken('asymmetric powers')).toBe('other');
  });

  it('resolves every state a merchant can declare', () => {
    expect(availabilityToken('reprint pending')).toBe('reprintPending');
    expect(availabilityToken('out of print')).toBe('outOfPrint');
  });

  it('walks the weight ramp in order and clamps past its ends', () => {
    expect(weightStop(1)).toBe(1);
    expect(weightStop(2.4)).toBe(3);
    expect(weightStop(5)).toBe(5);
    expect(weightStop(0)).toBe(1);
    expect(weightStop(9)).toBe(5);
    // The ramp's own stops are the library's, and it runs one direction.
    expect(Object.keys(weightRamp)).toEqual(['1', '2', '3', '4', '5']);
  });
});
