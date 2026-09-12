import { Injectable, NotFoundException } from '@nestjs/common';
import { GAMES_CATALOGUE } from './games.catalogue.js';
import type { Game } from './game.model.js';

/** Read-only accessor over the static GAMES_CATALOGUE. */
@Injectable()
export class GamesService {
  findAll(): Game[] {
    return [...GAMES_CATALOGUE];
  }

  /** Throws rather than returning undefined when nothing matches -- the
   * return type is Game, not an optional. */
  findByUrn(urn: string): Game {
    const game = GAMES_CATALOGUE.find((candidate) => candidate.urn === urn);
    if (!game) {
      throw new NotFoundException(`No game found for ${urn}`);
    }
    return game;
  }
}
