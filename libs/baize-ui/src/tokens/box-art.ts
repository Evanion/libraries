/**
 * Gradient palettes for the box-art placeholder: three stops each, ordered
 * light to dark.
 *
 * These stand in for a photograph of a box. A palette approximates the colours a
 * real box is printed in, so that a catalogue with no photography still reads as
 * a shelf of different games rather than a grid of identical grey tiles.
 *
 * **They are not a third informational colour system.** Mechanism hue says what
 * kind of game this is and availability says whether you can buy it; a palette
 * says nothing a reader has to decode, the same way a photograph says nothing.
 * Two rules keep it that way, both tested in `box-art.test.ts`:
 *
 * - No palette is named after a mechanism or an availability state, so no reader
 *   can learn that this gradient means co-op.
 * - The `--baize-box-art-*` properties are referenced only inside the
 *   `.baize-box-art` rules, never as a text or border colour.
 *
 * Named after pigments and materials rather than after games. Which game gets
 * which palette is catalogue data and belongs to the app: the app maps its own
 * entries onto these names and passes the name in. A game whose box matches
 * nothing here is a new palette in this file, reviewed the way a new mechanism
 * hue is, and until then it falls back to the neutral gradient -- which is what
 * `BoxArtPlaceholder` renders with no palette at all.
 */
export const boxArt = {
  /** Industrial soot under brass. */
  soot: { from: '#C8922F', via: '#4A3B2A', to: '#1A1714' },
  /** Pale sky over water. */
  sky: { from: '#8FD3D0', via: '#4E8C93', to: '#1E3036' },
  /** Dark red leather and gilt. */
  garnet: { from: '#C04A5A', via: '#6B2430', to: '#1E1114' },
  /** Glazed azure. */
  cobalt: { from: '#6FA8E8', via: '#2B5BA8', to: '#121E33' },
  /** Fired clay and sun. */
  terracotta: { from: '#D98A53', via: '#8A4B2C', to: '#2A1912' },
  /** Old gold over olive. */
  olive: { from: '#C9B561', via: '#6E6A2E', to: '#1E2012' },
  /** Autumn woodland. */
  rust: { from: '#E0803C', via: '#6E4A22', to: '#1D2618' },
  /** Wet foliage. */
  verdant: { from: '#7FD79A', via: '#2F7A55', to: '#112A1E' },
  /** Signal red on asphalt. */
  vermilion: { from: '#F0604C', via: '#8C2A20', to: '#22201F' },
  /** Bare wood. */
  oak: { from: '#D8AE78', via: '#8A6038', to: '#2A2018' },
  /** Night and spirits. */
  indigo: { from: '#8C8FE8', via: '#3A3A8C', to: '#14142A' },
  /** Turned earth. */
  loam: { from: '#B79A63', via: '#6A5B33', to: '#1F1C13' },
} as const;

/** A named gradient palette. Selects tokens; carries no meaning of its own. */
export type BoxArtPalette = keyof typeof boxArt;

/** The three stops a palette defines, light to dark. */
export type BoxArtStop = keyof (typeof boxArt)[BoxArtPalette];
