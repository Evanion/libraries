import type { BoxArtPalette } from '../tokens/box-art.js';
import { classNames, paletteClass } from './class-names.js';

export interface BoxArtPlaceholderProps {
  /**
   * Which gradient palette to paint. Selects tokens and nothing else: a palette
   * carries no meaning a reader has to decode, the same way a photograph of a box
   * carries none.
   *
   * Omitted, the tile paints the neutral gradient -- felt lit from the top left.
   * That is the honest rendering for a catalogue entry nobody has mapped yet, and
   * it is what every entry looks like before an app maps any of them.
   */
  palette?: BoxArtPalette;
  /**
   * What the tile says while there is no photograph: the game's title, as the
   * catalogue spells it.
   *
   * With no label the tile is decoration and is hidden from assistive technology,
   * because a gradient standing in for a picture of a box has nothing to say
   * about the box.
   */
  label?: string;
}

/**
 * A blurred gradient where a photograph of the box will go.
 *
 * Box art is the one place photographic colour belongs on this system, and a shop
 * with no photography yet has a grid of holes. A gradient in roughly the box's
 * colours fills them without pretending to be the picture: it is soft enough at
 * every size that nobody reads it as a failed image load.
 *
 * CSS-only. The softness is the falloff on layered radial gradients, not a
 * `filter: blur()` -- a blur would cost a compositing layer per tile, and on a
 * grid of twenty tiles that is twenty layers for an effect the gradient already
 * has.
 *
 * `aspect-ratio` plus `max-width: 100%` rather than a width and a height: the tile
 * stands in for an image, so it has to behave like one inside a grid cell that is
 * narrower than it would like.
 */
export function BoxArtPlaceholder({ palette, label }: BoxArtPlaceholderProps) {
  return (
    <div
      aria-hidden={label ? undefined : true}
      className={classNames('baize-box-art', palette && paletteClass(palette))}
    >
      {label ? <span className="baize-box-art__label">{label}</span> : null}
    </div>
  );
}
