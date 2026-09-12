/**
 * The contrast floor every mechanism hue is held to, against `felt`.
 *
 * A mechanism hue carries a game title and the tags under it, both of which are
 * text, so the floor is WCAG AA for normal text rather than the 3:1 large-text
 * allowance. `mechanism.test.ts` computes the ratio for every hue below and
 * fails naming the one that drops under this number.
 */
export const MECHANISM_CONTRAST_FLOOR = 4.5;

/**
 * Categorical hues, one per mechanism family, used on game titles and on the
 * tags under them.
 *
 * Categorical rather than ordinal: no mechanism outranks another, so the hues are
 * spread around the wheel at a roughly even lightness instead of forming a ramp.
 *
 * `other` is the hue for a mechanism with no entry here -- warm grey, and the
 * only unsaturated value in the scale, so an unmapped mechanism reads as
 * uncategorised rather than as a ninth category.
 *
 * The vocabulary is what the catalogue contains, not a fixed five. A mechanism
 * the catalogue starts carrying is a new entry here, reviewed against the floor
 * above, and renders as `other` until then.
 */
export const mechanism = {
  engineBuilding: '#E9B24C',
  economic: '#D8D36A',
  cooperative: '#8FD99A',
  tilePlacement: '#6FD6C2',
  workerPlacement: '#7FC4E8',
  deckbuilder: '#9FB0F0',
  areaControl: '#C98BE0',
  dexterity: '#F09A8A',
  other: '#C0B39A',
} as const;

/** The mechanism families the hue scale covers. */
export type Mechanism = keyof typeof mechanism;
