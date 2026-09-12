import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { GameURN } from '../domain/game.urn.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  it('returns the stock level for a known game', () => {
    const service = new InventoryService();
    const urn = GameURN.stringify('wingspan');

    const stock = service.getStock(urn);

    expect(stock.urn).toBe(urn);
    expect(typeof stock.quantity).toBe('number');
  });

  it('throws NotFoundException for a game with no stock record', () => {
    const service = new InventoryService();

    expect(() => service.getStock('urn:game:does-not-exist')).toThrow(
      NotFoundException,
    );
  });
});
