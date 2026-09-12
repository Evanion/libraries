import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { GamesService } from './games.service.js';

describe('GamesService', () => {
  it('lists every game in the catalogue', () => {
    const service = new GamesService();

    const games = service.findAll();

    expect(games.length).toBeGreaterThan(0);
    expect(games[0]).toHaveProperty('urn');
    expect(games[0]).toHaveProperty('title');
  });

  it('finds a game by its urn', () => {
    const service = new GamesService();
    const first = service.findAll().at(0);
    if (!first) throw new Error('expected at least one game in the catalogue');

    const found = service.findByUrn(first.urn);

    expect(found).toEqual(first);
  });

  it('throws NotFoundException for an unknown urn', () => {
    const service = new GamesService();

    expect(() => service.findByUrn('urn:game:does-not-exist')).toThrow(
      NotFoundException,
    );
  });
});
