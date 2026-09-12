import { GameURN } from '../domain/game.urn.js';
import type { Game } from './game.model.js';

/** In-memory catalogue. No persistence, per the demo's scope. */
export const GAMES_CATALOGUE: readonly Game[] = [
  {
    urn: GameURN.stringify('wingspan'),
    title: 'Wingspan',
    mechanisms: ['engine building', 'set collection'],
    players: '1-5',
    playtime: '40-70 min',
    weight: 2.4,
  },
  {
    urn: GameURN.stringify('brass-birmingham'),
    title: 'Brass: Birmingham',
    mechanisms: ['network building', 'economic'],
    players: '2-4',
    playtime: '60-120 min',
    weight: 3.9,
  },
  {
    urn: GameURN.stringify('gloomhaven'),
    title: 'Gloomhaven',
    mechanisms: ['co-op', 'legacy', 'tactical combat'],
    players: '1-4',
    playtime: '60-120 min',
    weight: 3.9,
  },
  {
    urn: GameURN.stringify('azul'),
    title: 'Azul',
    mechanisms: ['tile placement', 'pattern building'],
    players: '2-4',
    playtime: '30-45 min',
    weight: 1.8,
  },
] as const;
