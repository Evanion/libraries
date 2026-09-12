import { Injectable, NotFoundException } from '@nestjs/common';
import { GAMES_CATALOGUE } from './games.catalogue.js';
import type { Game } from './game.model.js';

/** Read-only accessor over the static GAMES_CATALOGUE. */
@Injectable()
export class GamesService {
  /** The whole catalogue. A copy, so a caller cannot edit the shared array. */
  findAll(): Game[] {
    return [...GAMES_CATALOGUE];
  }

  /**
   * The game with this urn, which is the full `urn:game:…` string.
   *
   * @throws {NotFoundException} when no game carries that urn, which Nest
   * renders as a 404.
   */
  findByUrn(urn: string): Game {
    const game = GAMES_CATALOGUE.find((candidate) => candidate.urn === urn);
    if (!game) {
      throw new NotFoundException(`No game found for ${urn}`);
    }
    return game;
  }
}
