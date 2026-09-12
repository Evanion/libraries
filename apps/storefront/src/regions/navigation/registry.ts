import { defineBlocks } from '@evanion/astro-widget';
import CartLink from './CartLink.astro';
import NavLink from './NavLink.astro';

/**
 * The navigation region's registry: a small region, three items, authored in
 * `data/navigation.json`.
 *
 * Its own registry rather than a shared one, because a region is as much the set
 * of blocks allowed in it as it is the list of blocks in it. A content block in
 * the nav bar is a data error, and keeping the registries apart is what makes it
 * one -- `Widgets` skips a type the registry does not hold.
 */
export const navigationRegistry = defineBlocks({
  link: NavLink,
  cart: CartLink,
});

/** Fields `validateBlocks` must find on each type. */
export const navigationRequired = {
  link: ['label', 'href'],
  cart: ['label', 'href'],
};
