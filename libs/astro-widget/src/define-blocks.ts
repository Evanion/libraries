import type { BlockRegistry } from './types';

/**
 * Returns the registry unchanged, typed as the literal object that was passed.
 *
 * The generic parameter is the whole point: annotating the same object as
 * `BlockRegistry` widens its keys to `string`, and the key union is what an
 * editor completes on and what a caller narrows a `required` map against.
 *
 * @example
 * ```ts
 * import Hero from './Hero.astro';
 * import Text from './Text.astro';
 *
 * const registry = defineBlocks({ hero: Hero, text: Text });
 * //    ^? { hero: AstroComponentFactory; text: AstroComponentFactory }
 * ```
 */
export function defineBlocks<M extends BlockRegistry>(map: M): M {
  return map;
}
