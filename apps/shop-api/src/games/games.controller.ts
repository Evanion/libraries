import { Controller, Get, Param } from '@nestjs/common';
import type { Game } from './game.model.js';
import { GamesService } from './games.service.js';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  findAll(): Game[] {
    return this.games.findAll();
  }

  @Get(':urn')
  findOne(@Param('urn') urn: string): Game {
    return this.games.findByUrn(urn);
  }
}
