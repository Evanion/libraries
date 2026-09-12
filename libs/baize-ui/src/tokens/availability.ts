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

/** The stock states the pill renders. */
export type Availability = keyof typeof availability;
