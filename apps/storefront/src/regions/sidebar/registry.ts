import { defineBlocks } from '@evanion/astro-widget';
import MechanismFilter from './MechanismFilter.astro';
import OpeningHours from './OpeningHours.astro';
import Promo from './Promo.astro';

/**
 * The sidebar region's registry: a small region beside the category listing,
 * authored in `data/sidebar.json`.
 *
 * The filter is a block like the rest. An editor can move it below the opening
 * hours, or drop it from the page entirely, without touching the listing it
 * filters -- which is the reason the sidebar is a region rather than markup.
 */
export const sidebarRegistry = defineBlocks({
  filter: MechanismFilter,
  hours: OpeningHours,
  promo: Promo,
});

/** Fields `validateBlocks` must find on each type. */
export const sidebarRequired = {
  filter: ['heading'],
  hours: ['heading', 'rows'],
  promo: ['heading', 'body', 'href', 'label'],
};
