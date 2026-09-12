/**
 * The contrast floor every weight stop is held to, against `felt`.
 *
 * 3:1, the WCAG floor for a non-text graphic, because the ramp paints the pips
 * beside the weight figure and never the figure itself -- that stays `chalk`.
 */
export const WEIGHT_CONTRAST_FLOOR = 3;

/**
 * Five stops, darkest first. Weight is ordinal, so the ramp is sequential in
 * lightness within one hue.
 *
 * The direction is part of the token: a filled pip gets its own stop's colour, so
 * the bar lightens left to right and a heavier game reads brighter. The two apps
 * that built this independently ran the ramp in opposite directions, which is the
 * drift this scale exists to end.
 *
 * Neutral on purpose. A hue here would read as a third informational colour
 * system next to mechanism and availability, and a reader would have to learn
 * that this particular green means 4 rather than meaning co-op.
 *
 * The darkest stop is lifted off the storefront's original `#3b5a52`, which
 * reached 2.1:1 on felt and was invisible at a pip's 3px.
 */
export const weight = {
  1: '#5A7A6F',
  2: '#6F8C81',
  3: '#8AA096',
  4: '#A7B9AE',
  5: '#C2CDC4',
} as const;

/** A stop on the weight ramp. Ordinal, 1 to 5. */
export type WeightStop = keyof typeof weight;
