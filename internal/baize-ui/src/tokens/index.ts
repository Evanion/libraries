/**
 * The token values, as TypeScript. The `@evanion/baize-ui/tokens` entry.
 *
 * Nothing in this graph imports React: a build script, a Nest response or a test
 * that needs the availability hue should not pull a renderer in behind it.
 */
export { ground } from './ground.js';
export type { GroundToken } from './ground.js';
export { leading, text, tracking, type } from './type.js';
export type {
  LeadingToken,
  TextToken,
  TrackingToken,
  TypeToken,
} from './type.js';
export { elevation, measure, motion, radius, space } from './geometry.js';
export type {
  ElevationToken,
  MotionToken,
  RadiusToken,
  SpaceToken,
} from './geometry.js';
export {
  categorical,
  categoricalOnLight,
  CATEGORICAL_CONTRAST_FLOOR,
  CATEGORICAL_DARK_GROUND,
  CATEGORICAL_LIGHT_GROUND,
} from './categorical.js';
export type { CategoricalHue } from './categorical.js';
export { mechanism, MECHANISM_CONTRAST_FLOOR } from './mechanism.js';
export type { Mechanism } from './mechanism.js';
export {
  platform,
  platformOnLight,
  PLATFORM_CONTRAST_FLOOR,
  PLATFORM_DARK_GROUND,
  PLATFORM_LIGHT_GROUND,
} from './platform.js';
export type { Platform } from './platform.js';
export { availability, AVAILABILITY_CONTRAST_FLOOR } from './availability.js';
export type { Availability } from './availability.js';
export {
  complexity,
  COMPLEXITY_CONTRAST_FLOOR,
  complexityTier,
  complexityTiers,
} from './complexity.js';
export type { ComplexityStop, ComplexityTier } from './complexity.js';
export { boxArt, boxArtPhoto } from './box-art.js';
export type { BoxArtPalette, BoxArtStop } from './box-art.js';
export {
  BOX_ART_MAX_DEPTH,
  BOX_ART_VIEW_BOX,
  boxArtScene,
} from './box-art-scene.js';
export type { BoxArtDepth, BoxArtRidge, BoxArtScene } from './box-art-scene.js';
export { customProperties, renderTokensCss } from './custom-properties.js';
/**
 * The class names the stylesheet binds each token enum through.
 *
 * On this entry rather than on `.` because the consumer that needs them is
 * `apps/storefront`, which renders no React: an `.astro` component resolves a
 * mechanism to `baize-hue-worker-placement` here instead of spelling the
 * convention out a second time.
 */
export {
  categoricalClass,
  classNames,
  hueClass,
  ladderClass,
  modifier,
  paletteClass,
  platformClass,
  stateClass,
} from './class-names.js';
