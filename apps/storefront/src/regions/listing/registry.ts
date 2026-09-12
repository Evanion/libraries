import { defineBlocks, type BlockItem } from '@evanion/astro-widget';
import GameCard from '../../components/GameCard.astro';
import type { Game } from '../../lib/shop-api.js';

/**
 * The listing region's registry: one block type, the game card.
 *
 * The large-region case. Its items are not CMS data -- they are built from the
 * API response by {@link listingItems} -- which is the other half of what a
 * region is for: a registry renders a list of blocks, and where that list came
 * from is the caller's business.
 */
export const listingRegistry = defineBlocks({ game: GameCard });

/** Fields `validateBlocks` must find on each type. */
export const listingRequired = { game: ['game'] };

/**
 * Turns a catalogue response into listing blocks.
 *
 * @param featured The urn to give a two-column cell, if it is in `games`. It
 * reaches the chrome through `meta` and never the card, because how wide a cell
 * sits is the listing's decision and not the card's.
 */
export function listingItems(
  games: readonly Game[],
  featured?: string,
): BlockItem[] {
  return games.map((game) => ({
    type: 'game',
    id: game.urn,
    game,
    meta: { span: game.urn === featured ? 2 : 1 },
  }));
}
