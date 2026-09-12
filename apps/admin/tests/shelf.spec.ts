import { describe, expect, it } from 'vitest';
import {
  availabilityCounts,
  availabilityOf,
  buildShelf,
  shelfTotals,
} from '../app/shelf.js';
import {
  mechanismHue,
  mechanismHues,
  weightColor,
  weightRamp,
} from '../app/ui/baize.js';
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

describe('the colour channels', () => {
  it('gives a mechanism the same hue every time, in any app', () => {
    expect(mechanismHue('engine building')).toBe(
      mechanismHue('Engine Building'),
    );
    expect(mechanismHues).toContain(mechanismHue('dexterity'));
  });

  it('walks the weight ramp in order and clamps past its ends', () => {
    expect(weightColor(1)).toBe(weightRamp[0]);
    expect(weightColor(2.4)).toBe(weightRamp[2]);
    expect(weightColor(5)).toBe(weightRamp[4]);
    expect(weightColor(0)).toBe(weightRamp[0]);
    expect(weightColor(9)).toBe(weightRamp[4]);
  });
});
