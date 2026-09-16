import type { Availability } from './availability.js';
import type { CategoricalHue } from './categorical.js';
import type { BoxArtPalette } from './box-art.js';
import type { ComplexityStop } from './complexity.js';
import type { Mechanism } from './mechanism.js';
import type { Platform } from './platform.js';

/**
 * The class names `styles.css` binds a token enum through, as functions of the
 * enum member.
 *
 * On the React-free entry because the consumers that need them most render no
 * React. `apps/storefront` is pure Astro: its `.astro` components emit these
 * class names from frontmatter, and a component that spelled
 * `baize-hue-worker-placement` as a literal would be a second copy of the
 * stylesheet's naming convention, drifting the moment a token is renamed. The
 * React components in `@evanion/baize-ui` resolve the same names through the same
 * functions.
 *
 * `slug` is the only place the convention lives: `tokens/custom-properties.ts`
 * kebab-cases a token name for its custom property, and these kebab-case the same
 * name for the class that reads it.
 */

/** `workerPlacement` -> `worker-placement`, as the custom properties spell it. */
export function slug(value: string | number): string {
  return String(value).replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
}

/**
 * A variant prop as the modifier class that styles it.
 *
 * `modifier('baize-button', 'variant', 'primary')` is
 * `baize-button--variant-primary`.
 */
export function modifier(
  base: string,
  name: string,
  value: string | number,
): string {
  return `${base}--${name}-${slug(value)}`;
}

/**
 * The class that binds a mechanism hue, as `--baize-hue`, for whatever element
 * carries it.
 *
 * One class for every component that takes a mechanism, rather than a modifier
 * per component: a title, a chip and a tag all want the same hue, and binding it
 * once keeps the stylesheet at one rule per mechanism instead of one per
 * mechanism per component.
 */
export function hueClass(mechanism: Mechanism): string {
  return `baize-hue-${slug(mechanism)}`;
}

/**
 * The class that binds a categorical hue, as `--baize-hue`.
 *
 * The scale rather than one app's vocabulary: `hueClass` is the shop's mechanism
 * families, and this is what the docs site's packages take, on the same nine
 * values. Both resolve to the same custom property, so every component that
 * reads `--baize-hue` works under either.
 */
export function categoricalClass(hue: CategoricalHue): string {
  return `baize-categorical-${slug(hue)}`;
}

/**
 * The class that binds a platform hue, as `--baize-hue`, for the chip that
 * names the platform.
 *
 * The same property the categorical and mechanism classes bind, so `Chip`
 * reads one property whichever scale the colour came from.
 */
export function platformClass(platform: Platform): string {
  return `baize-platform-${slug(platform)}`;
}

/**
 * The class that binds a complexity stop's ramp colour, as `--baize-ladder`.
 *
 * One class per stop rather than a modifier per component, for the same reason
 * `hueClass` is one class: the title takes it on a card and the stat cell's figure
 * could take it on a page, and the stylesheet stays at one rule per stop.
 */
export function ladderClass(stop: ComplexityStop): string {
  return `baize-ladder-${stop}`;
}

/** The class that binds an availability colour, as `--baize-state`. */
export function stateClass(availability: Availability): string {
  return `baize-state-${slug(availability)}`;
}

/** The class that binds a box-art palette's three stops. */
export function paletteClass(palette: BoxArtPalette): string {
  return `baize-palette-${slug(palette)}`;
}

/**
 * Joins the class names a caller resolved, dropping the ones that did not apply.
 *
 * Here rather than in each consumer because the alternative in an `.astro`
 * template is a ternary per optional class inside a `class` attribute, and that is
 * where a stray `undefined` ends up in the rendered markup.
 */
export function classNames(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
