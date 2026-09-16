import { categorical, CATEGORICAL_CONTRAST_FLOOR } from './categorical.js';

/**
 * The contrast floor every mechanism hue is held to, against `felt`.
 *
 * A mechanism hue carries a game title and the tags under it, both of which are
 * text, so the floor is WCAG AA for normal text rather than the 3:1 large-text
 * allowance. `mechanism.test.ts` computes the ratio for every hue below and
 * fails naming the one that drops under this number.
 */
export const MECHANISM_CONTRAST_FLOOR = CATEGORICAL_CONTRAST_FLOOR;

/**
 * Categorical hues, one per mechanism family, used on game titles and on the
 * tags under them.
 *
 * The shop's vocabulary mapped onto the categorical scale in `categorical.ts`,
 * rather than a second table of hexes. The docs site maps its packages onto the
 * same nine values, and one scale is what keeps the two from drifting into two
 * sets of nearly-equal colours.
 *
 * `other` is the hue for a mechanism with no entry here -- `stone`, warm grey,
 * the only unsaturated value in the scale, so an unmapped mechanism reads as
 * uncategorised rather than as a ninth category.
 *
 * The vocabulary is what the catalogue contains, not a fixed five. A mechanism
 * the catalogue starts carrying is a new entry here, reviewed against the floor
 * above, and renders as `other` until then.
 */
export const mechanism = {
  engineBuilding: categorical.amber,
  economic: categorical.citron,
  cooperative: categorical.mint,
  tilePlacement: categorical.teal,
  workerPlacement: categorical.sky,
  deckbuilder: categorical.periwinkle,
  areaControl: categorical.orchid,
  dexterity: categorical.coral,
  other: categorical.stone,
} as const;

/** The mechanism families the hue scale covers. */
export type Mechanism = keyof typeof mechanism;
