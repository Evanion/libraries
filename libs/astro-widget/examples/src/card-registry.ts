import { defineWidgets } from '@evanion/astro-widget';

import GameCard from './widgets/GameCard.astro';

/**
 * The registry `GameGrid` renders its children through.
 *
 * A module of its own, so the registry `GameGrid` imports holds no import of
 * `GameGrid`, and a registry that did hold `GameGrid` could import it without a
 * cycle.
 */
export const cardRegistry = defineWidgets({ 'game-card': GameCard });
