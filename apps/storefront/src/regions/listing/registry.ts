import { defineWidgets, type AnyWidgetItem } from '@evanion/astro-widget';
import GameCard from '../../components/GameCard.astro';
import type { Game } from '../../lib/shop-api.js';

/**
 * The listing region's registry: one widget type, the game card.
 *
 * The large-region case. Its items are not CMS data -- they are built from the
 * API response by {@link listingItems} -- which is the other half of what a
 * region is for: a registry renders a list of items, and where that list came
 * from is the caller's business.
 */
export const listingRegistry = defineWidgets({ game: GameCard });

/** Fields `validateItems` must find on each type. */
export const listingRequired = { game: ['game', 'back'] };

/**
 * Turns a catalogue response into listing items.
 *
 * @param back Where a card's add-to-cart returns the shopper to. A card prop
 * and not `meta`: the card posts it, so it is the card's business, and a listing
 * on the landing page and the same listing on a category page have to send a
 * shopper back to two different places.
 * @param featured The urn to give a two-column cell, if it is in `games`. It
 * reaches the chrome through `meta` and never the card, because how wide a cell
 * sits is the listing's decision and not the card's.
 */
export function listingItems(
  games: readonly Game[],
  back: string,
  featured?: string,
): AnyWidgetItem[] {
  return games.map((game) => ({
    id: game.urn,
    type: 'game',
    props: { game, back },
    meta: { span: game.urn === featured ? 2 : 1 },
  }));
}
