import type { WidgetRegistry } from './types.js';

/**
 * Returns the registry unchanged, typed as the literal object that was passed.
 *
 * The generic parameter is the whole point: annotating the same object as
 * `WidgetRegistry` widens its keys to `string`, and the key union is what an
 * editor completes on and what a caller narrows a `required` map against.
 *
 * In the core rather than in an adapter because every adapter needs it, and
 * because a React consumer assembling a registry before handing it to
 * `createWidgets` wants it too.
 *
 * @example
 * ```ts
 * import Hero from './Hero.astro';
 * import Text from './Text.astro';
 *
 * const registry = defineWidgets({ hero: Hero, text: Text });
 * //    ^? { hero: AstroComponentFactory; text: AstroComponentFactory }
 * ```
 */
export function defineWidgets<R extends WidgetRegistry>(registry: R): R {
  return registry;
}
