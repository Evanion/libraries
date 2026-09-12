import { defineBlocks } from '@evanion/astro-widget';
import CatalogueBlock from './CatalogueBlock.astro';
import ContentGroup from './ContentGroup.astro';
import FeatureGame from './FeatureGame.astro';
import MechanismBar from './MechanismBar.astro';
import Prose from './Prose.astro';

/**
 * The content region's registry: the landing page, authored in
 * `data/landing.json`.
 *
 * `group` is here and `card` is not: a card is only valid inside a group, so it
 * lives in group.registry.ts. A registry is the list of block types a region
 * admits, and `Widgets` skips a type its registry does not hold -- which is what
 * makes `card` at the top level a no-op rather than a stray panel.
 */
export const contentRegistry = defineBlocks({
  feature: FeatureGame,
  prose: Prose,
  group: ContentGroup,
  catalogue: CatalogueBlock,
  mechanisms: MechanismBar,
});

/** Fields `validateBlocks` must find on each type. */
export const contentRequired = {
  feature: ['urn', 'lede'],
  prose: ['paragraphs'],
  group: ['heading'],
  catalogue: ['heading'],
  mechanisms: ['heading'],
};
