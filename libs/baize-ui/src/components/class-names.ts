import type { Availability } from '../tokens/availability.js';
import type { BoxArtPalette } from '../tokens/box-art.js';
import type { Mechanism } from '../tokens/mechanism.js';

/**
 * Joins the class names a component resolved, dropping the ones that did not
 * apply.
 *
 * Every component here renders class names and nothing else: no inline styles, no
 * CSS-in-JS, no `style` prop. A colour or a radius reaches the element through a
 * class in `styles.css`, which is the only form an `.astro` style block and an
 * MDX page can also consume.
 */
export function classNames(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** `workerPlacement` -> `worker-placement`, as `tokens/custom-properties.ts` spells it. */
function slug(value: string | number): string {
  return String(value).replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
}

/**
 * A variant prop rendered as the modifier class that styles it.
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

/** The class that binds an availability colour, as `--baize-state`. */
export function stateClass(availability: Availability): string {
  return `baize-state-${slug(availability)}`;
}

/** The class that binds a box-art palette's three stops. */
export function paletteClass(palette: BoxArtPalette): string {
  return `baize-palette-${slug(palette)}`;
}
