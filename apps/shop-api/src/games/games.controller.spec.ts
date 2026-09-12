import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { GameURN } from '../domain/game.urn.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

describe('GamesController', () => {
  it('lists every game', async () => {
    const module = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [GamesService],
    }).compile();
    const controller = module.get(GamesController);

    const games = controller.findAll();

    expect(games.length).toBeGreaterThan(0);
  });

  it('gets one game by urn', async () => {
    const module = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [GamesService],
    }).compile();
    const controller = module.get(GamesController);
    const urn = GameURN.stringify('wingspan');

    const game = controller.findOne(urn);

    expect(game.urn).toBe(urn);
  });
});
