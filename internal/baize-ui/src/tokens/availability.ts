/**
 * The contrast floor every availability colour is held to, against `felt`.
 *
 * An availability colour is pill text, so it is held to the same normal-text
 * floor as the mechanism hues. `availability.test.ts` checks each one.
 */
export const AVAILABILITY_CONTRAST_FLOOR = 4.5;

/**
 * Four state colours. A state pill is the only place they appear.
 *
 * `outOfPrint` is `lichen` rather than `moss`: moss is the tertiary text colour
 * and reaches only 3.15:1 on felt, which is under the floor for the pill's own
 * label.
 *
 * The four sit at a lower chroma than the mechanism hues and are read through a
 * dot and an uppercase label, which is what keeps the two systems apart where
 * their hue families meet on one card.
 */
export const availability = {
  inStock: '#7FB88C',
  preorder: '#8FA8D8',
  reprintPending: '#C9A15E',
  outOfPrint: '#8FA69E',
} as const;

/**
 * The ground a light theme lays an availability pill on.
 *
 * The same value `CATEGORICAL_LIGHT_GROUND` names, for the same reason: a
 * consumer that rebinds `felt` for a light theme lays the pill on paper, and
 * the floor above is measured against the dark felt.
 */
export const AVAILABILITY_LIGHT_GROUND = '#E5E2D8';

/**
 * The same four states on a light ground.
 *
 * The dark values reach between 1.77:1 and 2.00:1 on paper, so a light theme
 * needs its own rather than the dark ones reused. Each is its dark
 * counterpart's hue angle and chroma in OKLCH with the lightness walked down
 * until the ratio against `AVAILABILITY_LIGHT_GROUND` clears the floor, so a
 * state keeps one recognisable colour across both themes.
 *
 * This is `categoricalOnLight`'s derivation applied to the scale that was
 * missing it. The floor was checked against `felt` alone, so a consumer
 * rebinding `felt` for paper shipped a pill nothing had measured.
 */
export const availabilityOnLight = {
  inStock: '#397048',
  preorder: '#4E6591',
  reprintPending: '#835E15',
  outOfPrint: '#546962',
} as const;

/** The stock states the pill renders. */
export type Availability = keyof typeof availability;
