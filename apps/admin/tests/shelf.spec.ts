import { describe, expect, it } from 'vitest';
import {
  availabilityCounts,
  availabilityOf,
  buildShelf,
  shelfTotals,
} from '../app/shelf.js';
import { complexity as complexityRamp } from '@evanion/baize-ui/tokens';
import {
  availabilityToken,
  complexityStop,
  complexityTierName,
} from '../app/ui/catalogue.js';
import type { Game, Stock } from '../app/shop-api.server.js';

const games: Game[] = [
  {
    urn: 'urn:game:wingspan',
    title: 'Wingspan',
    mechanisms: ['engine building'],
    players: '1-5',
    playtime: '40-70 min',
    complexity: 2.4,
  },
  {
    urn: 'urn:game:brass-birmingham',
    title: 'Brass: Birmingham',
    mechanisms: ['network building'],
    players: '2-4',
    playtime: '60-120 min',
    complexity: 3.9,
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
      meanComplexity: 3.15,
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
 * The channels the shelf hands to `@evanion/baize-ui`.
 *
 * The shelf maps a merchant's state wording and a rating onto the library's enums.
 * Mechanism is not among them: the back office shows a mechanism as its name, so
 * there is no hue for this app to resolve and no second palette for it to drift
 * into.
 */
describe('the channels the shelf maps onto', () => {
  it('names the tier a buyer reads the shelf by', () => {
    expect(complexityTierName(1.1)).toBe('Gateway');
    expect(complexityTierName(2.4)).toBe('Midweight');
    expect(complexityTierName(4)).toBe('Brain-burner');
  });

  it('resolves every state a merchant can declare', () => {
    expect(availabilityToken('reprint pending')).toBe('reprintPending');
    expect(availabilityToken('out of print')).toBe('outOfPrint');
  });

  it('walks the complexity ramp in tier order and clamps past its ends', () => {
    expect(complexityStop(1)).toBe(1);
    expect(complexityStop(1.7)).toBe(2);
    expect(complexityStop(2.4)).toBe(3);
    expect(complexityStop(3.6)).toBe(4);
    expect(complexityStop(3.9)).toBe(5);
    expect(complexityStop(0)).toBe(1);
    expect(complexityStop(9)).toBe(5);
    // The ramp's own stops are the library's, and it runs one direction.
    expect(Object.keys(complexityRamp)).toEqual(['1', '2', '3', '4', '5']);
  });
});
