import { Injectable, NotFoundException } from '@nestjs/common';
import { GAMES_CATALOGUE } from './games.catalogue.js';
import type { Game } from './game.model.js';

@Injectable()
export class GamesService {
  findAll(): Game[] {
    return [...GAMES_CATALOGUE];
  }

  findByUrn(urn: string): Game {
    const game = GAMES_CATALOGUE.find((candidate) => candidate.urn === urn);
    if (!game) {
      throw new NotFoundException(`No game found for ${urn}`);
    }
    return game;
  }
}
