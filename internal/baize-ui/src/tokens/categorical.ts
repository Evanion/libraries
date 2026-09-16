/**
 * The contrast floor every categorical hue is held to, against both grounds.
 *
 * A categorical hue carries a title and the small print under it, both of which
 * are text, so the floor is WCAG AA for normal text rather than the 3:1
 * large-text allowance. `tokens.test.ts` computes the ratio for every hue in
 * both scales and fails naming the one that drops under this number.
 */
export const CATEGORICAL_CONTRAST_FLOOR = 4.5;

/**
 * The raised surface each scale is measured against.
 *
 * `felt` on the dark ground. On the light ground the surface is not a token but
 * a mix -- the docs site lays `rule` into `chalk` at 6% for a card -- so the
 * resolved value is quoted here, which is what the floor is actually checked
 * against.
 */
export const CATEGORICAL_DARK_GROUND = '#142521';
export const CATEGORICAL_LIGHT_GROUND = '#E5E2D8';

/**
 * Categorical hues on a dark ground: one per member of whatever catalogue the
 * consuming app has.
 *
 * Categorical rather than ordinal: no member outranks another, so the hues are
 * spread around the wheel at a roughly even lightness instead of forming a ramp.
 * `stone` is the unsaturated one, for a member with no hue of its own, so it
 * reads as uncategorised rather than as a tenth category.
 *
 * Two apps map their own vocabulary onto this scale -- the shop's mechanism
 * families in `mechanism.ts`, the docs site's packages in its own navigation --
 * and the scale is separate from both so that neither has to describe a URN
 * library as engine building.
 */
export const categorical = {
  amber: '#E9B24C',
  citron: '#D8D36A',
  mint: '#8FD99A',
  teal: '#6FD6C2',
  sky: '#7FC4E8',
  periwinkle: '#9FB0F0',
  orchid: '#C98BE0',
  coral: '#F09A8A',
  stone: '#C0B39A',
} as const;

/**
 * The same nine hues on a light ground.
 *
 * A hue tuned to clear 4.5:1 on `felt` sits between 1.2:1 and 2.0:1 on paper --
 * `citron` is 10.21:1 dark and 1.20:1 light -- so a light theme needs its own
 * values rather than the dark ones reused. Each is its dark counterpart's hue
 * angle and chroma in OKLCH with the lightness walked down until the ratio
 * against `CATEGORICAL_LIGHT_GROUND` clears the floor, so a package keeps one
 * recognisable colour across both themes rather than two unrelated ones.
 */
export const categoricalOnLight = {
  amber: '#8B5800',
  citron: '#6C6500',
  mint: '#277138',
  teal: '#007060',
  sky: '#226A8B',
  periwinkle: '#53609A',
  orchid: '#864B9B',
  coral: '#9A4C3F',
  stone: '#6E624B',
} as const;

/** The hues the categorical scale carries. */
export type CategoricalHue = keyof typeof categorical;
