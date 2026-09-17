import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Requires } from '../acl/requires.decorator.js';
import type { Game } from './game.model.js';
import { GamesService, type GameDeclaration } from './games.service.js';

/**
 * HTTP surface over the games catalogue.
 *
 * The reads carry `@Requires('game', 'read')`, which the matrix allows for
 * every subject; the declaration write carries `@Requires('game', 'declare')`,
 * which AclGuard cannot finish without the row, so GamesService decides it.
 */
@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  @Requires('game', 'read')
  findAll(): Game[] {
    return this.games.findAll();
  }

  /**
   * @param urn The full urn, `urn:game:wingspan`, not the bare nss `wingspan`:
   * it is matched against `Game.urn`, which GameURN writes in full. Colons are
   * legal in a path segment, so nothing needs escaping on the way in.
   */
  @Get(':urn')
  @Requires('game', 'read')
  findOne(@Param('urn') urn: string): Game {
    return this.games.findByUrn(urn);
  }

  /**
   * Changes what the shop says about one title.
   *
   * The body states the fields a caller proposes; the write axis decides each
   * of them, so a manager's `price` lands and an operator's does not.
   */
  @Patch(':urn')
  @Requires('game', 'declare')
  declare(
    @Param('urn') urn: string,
    @Body() declaration: GameDeclaration,
  ): Game {
    return this.games.declare(urn, declaration);
  }
}
