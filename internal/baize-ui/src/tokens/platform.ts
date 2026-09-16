/**
 * The contrast floor every platform hue is held to, against both grounds.
 *
 * A platform hue is chip text, which is small text, so the floor is WCAG AA for
 * normal text. `tokens.test.ts` computes the ratio for every hue in both scales
 * and fails naming the one that drops under this number.
 */
export const PLATFORM_CONTRAST_FLOOR = 4.5;

/**
 * The surfaces each scale is measured against: `felt`, the card a chip sits
 * on, and the light-theme card the docs site mixes from `chalk` and `rule`.
 * The same two grounds the categorical scale is held to.
 */
export const PLATFORM_DARK_GROUND = '#142521';
export const PLATFORM_LIGHT_GROUND = '#E5E2D8';

/**
 * Platform hues on a dark ground: the colour each platform is known by, as a
 * chip a reader recognises before reading it.
 *
 * Each is the platform's own brand colour where that colour clears the floor
 * on `felt`, and the same hue walked in lightness until it does where it does
 * not. NestJS's red sits at 3.4:1 on felt and is lifted; React's cyan and
 * Astro's orange pass as published.
 *
 * `universal` is for a package that imports no framework and runs wherever
 * TypeScript does. That is not a platform with a mark of its own, so it takes
 * TypeScript's blue, which is what "wherever TypeScript runs" looks like.
 *
 * A separate scale from `categorical`, not a mapping onto it: a categorical
 * hue is an identity the consuming app assigns and a reader learns on the
 * page, and a platform hue is one the reader arrives already knowing. Putting
 * React's cyan on the categorical scale would make it a package's identity
 * somewhere, and a chip saying React in a package's own colour says nothing.
 */
export const platform = {
  react: '#58C4DC',
  astro: '#FF5D01',
  nestjs: '#EA5B7C',
  universal: '#4D8DD3',
} as const;

/**
 * The same four hues on a light ground.
 *
 * A brand colour is tuned for the platform's own site, and none of these four
 * clears 4.5:1 on paper -- React's cyan reaches 1.6:1. Each is its dark
 * counterpart's hue walked down in lightness until the ratio against
 * `PLATFORM_LIGHT_GROUND` clears the floor, so a platform keeps one
 * recognisable colour across both themes.
 */
export const platformOnLight = {
  react: '#1B6E80',
  astro: '#AE3F00',
  nestjs: '#C41C42',
  universal: '#2964A5',
} as const;

/** The platforms the scale carries. */
export type Platform = keyof typeof platform;
