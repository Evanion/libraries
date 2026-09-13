import type { CSSProperties } from 'react';
import { Fragment } from 'react';

import { boxArtPhoto, type BoxArtPalette } from '../tokens/box-art.js';
import { BOX_ART_VIEW_BOX, boxArtScene } from '../tokens/box-art-scene.js';
import { classNames, paletteClass } from './class-names.js';

export interface BoxArtPlaceholderProps {
  /**
   * Which palette to paint. Selects tokens and nothing else: a palette carries
   * no meaning a reader has to decode, the same way a photograph of a box
   * carries none.
   *
   * Omitted, the tile paints the neutral palette -- felt under a pale sky. That
   * is the honest rendering for a catalogue entry nobody has mapped yet, and it
   * is what every entry looks like before an app maps any of them.
   */
  palette?: BoxArtPalette;
  /**
   * What the landscape is drawn from. A game urn, so a title's vista is the same
   * one in every app and after every rebuild.
   *
   * Omitted, every tile draws the same vista, which is the one case where the
   * grid reads as wallpaper -- so pass it.
   */
  seed?: string;
  /**
   * What the tile says while there is no photograph: the game's title, as the
   * catalogue spells it.
   *
   * With no label the tile is decoration and is hidden from assistive
   * technology, because a landscape standing in for a picture of a box has
   * nothing to say about the box. That is the right call wherever the title is
   * already beside the tile, which on a card and on a detail page is everywhere.
   */
  label?: string;
  /**
   * A real photograph, once there is one. It paints over the vista.
   *
   * A URL and not a file: it is painted as a CSS background layer, so a URL that
   * 404s paints nothing and the generated vista underneath is what a reader
   * sees. That is what lets an app point at images it has not published yet
   * without a single card breaking, and what keeps local development working
   * with no network at all.
   */
  photo?: string;
}

/**
 * The tile a photograph of the box will eventually go on: until then, a vista.
 *
 * Box art is the one place photographic colour belongs on this system, and a
 * shop with no photography has a grid of holes without it. A blurred gradient
 * was the first answer and was the wrong one -- at card size it reads as an
 * image that failed to load. What reads as art instead is a landscape: layered
 * ridgelines fading into haze, a low sun behind them, and one solid form
 * breaking the horizon.
 *
 * Every shape comes from {@link boxArtScene}, seeded, so the same game draws the
 * same vista forever and twelve games draw twelve different ones. Every colour
 * comes from the palette's three stops, so a tile is still the colour the
 * catalogue gave it.
 *
 * SVG and CSS, with no raster asset and no `filter`. A filter would cost a
 * compositing layer per tile, and on a grid of twenty that is twenty layers for
 * depth the flat fills already carry: the ridges lighten towards the sky step by
 * step, which is atmospheric perspective and is the only thing that sells
 * distance in a vector drawing.
 *
 * `aspect-ratio` plus `max-width: 100%` rather than a width and a height: the
 * tile stands in for an image, so it has to behave like one inside a grid cell
 * narrower than it would like.
 */
export function BoxArtPlaceholder({
  palette,
  seed,
  label,
  photo,
}: BoxArtPlaceholderProps) {
  const scene = boxArtScene(seed ?? '');
  const image = boxArtPhoto(photo);

  // Custom properties rather than a class per light position: the sun moves
  // continuously with the seed, and a class set would quantise it to however
  // many rules somebody wrote.
  const style = {
    '--baize-art-light-x': scene.light.x,
    '--baize-art-light-y': scene.light.y,
    '--baize-art-horizon': scene.horizon,
    ...(image ? { '--baize-art-photo': image } : {}),
  } as CSSProperties;

  return (
    <div
      aria-hidden={label ? undefined : true}
      className={classNames('baize-box-art', palette && paletteClass(palette))}
      style={style}
    >
      <svg
        aria-hidden="true"
        className="baize-box-art__scene"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 ${BOX_ART_VIEW_BOX.width} ${BOX_ART_VIEW_BOX.height}`}
      >
        <circle
          className="baize-box-art__disc"
          cx={scene.disc.cx}
          cy={scene.disc.cy}
          r={scene.disc.r}
        />
        {/* Fill then crest, ridge by ridge from the back. Every fill first and
            every crest after would draw a far ridge's rim light across the near
            ridge standing in front of it. */}
        {scene.ridges.map((ridge) => (
          <Fragment key={ridge.depth}>
            <path
              className={`baize-box-art__ridge baize-box-art__ridge--depth-${ridge.depth}`}
              d={ridge.fill}
            />
            <path
              className={`baize-box-art__crest baize-box-art__crest--depth-${ridge.depth}`}
              d={ridge.crest}
            />
          </Fragment>
        ))}
        <path className="baize-box-art__fore" d={scene.foreground} />
      </svg>
      <div className="baize-box-art__photo" />
      {label ? <span className="baize-box-art__label">{label}</span> : null}
    </div>
  );
}
