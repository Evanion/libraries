import { Controller, Get, Param } from '@nestjs/common';
import type { Game } from './game.model.js';
import { GamesService } from './games.service.js';

/**
 * Read-only HTTP surface over the games catalogue.
 *
 * Every response comes straight from GamesService; there is no filtering,
 * pagination, or auth in front of it.
 */
@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  findAll(): Game[] {
    return this.games.findAll();
  }

  /** `urn` is the full urn string, e.g. `urn:game:wingspan` -- not the bare
   * nss `wingspan` -- since that is what Game.urn and GamesService compare
   * against. */
  @Get(':urn')
  findOne(@Param('urn') urn: string): Game {
    return this.games.findByUrn(urn);
  }
}
