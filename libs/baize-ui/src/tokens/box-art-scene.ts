/**
 * The vista a box-art tile draws, derived from a seed.
 *
 * The tile stands in for a photograph of a box. A gradient alone reads as a
 * failed image load at card size, so what goes there instead is a stylised
 * landscape: layered ridgelines receding into haze, a low sun behind them, and
 * one solid form breaking the horizon. Vector, generated, no raster asset --
 * which is what keeps it out of git, sharp at every size and working offline.
 *
 * Everything here is geometry. Not one value in this module is a colour: the
 * twelve pigment palettes in `box-art.ts` supply those, so a game's tile stays
 * the colour the catalogue already gave it and this file only decides the shapes.
 *
 * On the React-free entry, because both the React component and the storefront's
 * `.astro` template render the same scene and neither may be the one that owns
 * it. Given the same seed it returns the same scene forever: the seed is a game
 * urn, so a title's vista is stable across a reload, a rebuild and both apps.
 */

/** The coordinate space every path below is drawn in. 4:3, as the tile is. */
export const BOX_ART_VIEW_BOX = { width: 160, height: 120 } as const;

const { width: W, height: H } = BOX_ART_VIEW_BOX;

/** How far back a ridge sits. The stylesheet fades each step into the sky. */
export type BoxArtDepth = 0 | 1 | 2 | 3;

/** The farthest depth the stylesheet has a rule for. */
export const BOX_ART_MAX_DEPTH = 3;

export interface BoxArtRidge {
  /** The ridgeline itself, open, for the rim light along the crest. */
  crest: string;
  /** The same line closed down to the foot of the tile, for the silhouette. */
  fill: string;
  depth: BoxArtDepth;
}

export interface BoxArtScene {
  /** Where the light sits, as a percentage across and down the tile. */
  light: { x: string; y: string };
  /**
   * Where the land begins, as a percentage down the tile.
   *
   * A percentage rather than view-box units because the haze band that reads as
   * distance is a CSS layer over the drawing and not a shape in it: a band with
   * two hard edges is a stripe, and a soft one needs a gradient, which in SVG
   * needs an `id` -- and an `id` repeated across twenty tiles in one document is
   * twenty invalid duplicates.
   */
  horizon: string;
  /** The sun or moon disc, in view-box units. Drawn behind every ridge. */
  disc: { cx: number; cy: number; r: number };
  /** Back to front. Four at most, which is what the stylesheet paints. */
  ridges: BoxArtRidge[];
  /** The one solid form that breaks the horizon, nearest the reader. */
  foreground: string;
}

/** FNV-1a over the seed, so a urn becomes a number the same way every time. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/**
 * mulberry32. Small, and its whole job is to be the same sequence twice.
 *
 * `Math.random` is the thing this must not be: a tile that redrew itself on
 * every render would flicker under React's double render in development and
 * would differ between the server's HTML and the client's.
 */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two decimals. A path string is markup, and markup is paid for per byte. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One ridgeline across the full width, as alternating peaks and saddles.
 *
 * Straight segments rather than curves: the look is a cut-paper landscape, and a
 * smoothed ridge at 17rem wide reads as a blur where a faceted one reads as rock.
 *
 * Uneven spacing and a tilt across the whole line, both from the seed. Evenly
 * spaced peaks of one height are a sawtooth, and a grid of sawteeth reads as a
 * pattern rather than as twelve different places.
 */
function ridge(
  next: () => number,
  baseY: number,
  amplitude: number,
  vertices: number,
): BoxArtRidge['crest'] {
  const widths: number[] = [];
  let span = 0;
  for (let index = 0; index < vertices - 1; index += 1) {
    const width = 0.55 + next() * 0.9;
    widths.push(width);
    span += width;
  }

  const tilt = (next() - 0.5) * amplitude;
  const points: string[] = [];
  let x = 0;
  for (let index = 0; index < vertices; index += 1) {
    const along = index / (vertices - 1);
    const peak = index % 2 === 1;
    const rise = peak ? 0.5 + next() * 0.5 : next() * 0.24;
    const y = baseY + tilt * (along - 0.5) - amplitude * rise;
    points.push(`${round(x)} ${round(y)}`);
    if (index < vertices - 1) x += (widths[index] as number) * (W / span);
  }
  // The last vertex lands on the right edge whatever the widths summed to.
  points[points.length - 1] = `${W} ${
    points[points.length - 1]?.split(' ')[1] ?? baseY
  }`;
  return `M${points.join(' L')}`;
}

/** A watchtower: a tapered shaft under a spire, with the roof line stepped. */
function spire(cx: number, height: number): string {
  const foot = H;
  const top = H - height;
  return (
    `M${round(cx - 5.5)} ${foot}` +
    ` L${round(cx - 4)} ${round(top + 12)}` +
    ` L${round(cx - 4)} ${round(top + 5)}` +
    ` L${round(cx - 5.5)} ${round(top + 5)}` +
    ` L${round(cx - 5.5)} ${round(top + 1)}` +
    ` L${round(cx)} ${round(top - 9)}` +
    ` L${round(cx + 5.5)} ${round(top + 1)}` +
    ` L${round(cx + 5.5)} ${round(top + 5)}` +
    ` L${round(cx + 4)} ${round(top + 5)}` +
    ` L${round(cx + 4)} ${round(top + 12)}` +
    ` L${round(cx + 5.5)} ${foot} Z`
  );
}

/** A stand of conifers, each one two tiers so the edge reads as needles. */
function conifers(
  next: () => number,
  cx: number,
  height: number,
  count: number,
): string {
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = cx + (index - (count - 1) / 2) * 8.5;
    const tall = height * (0.62 + next() * 0.38);
    const skirt = H - tall * 0.42;
    const half = tall * 0.2;
    parts.push(
      `M${round(x)} ${round(H - tall)}` +
        ` L${round(x + half)} ${round(skirt)}` +
        ` L${round(x + half * 0.55)} ${round(skirt)}` +
        ` L${round(x + half * 1.5)} ${H}` +
        ` L${round(x - half * 1.5)} ${H}` +
        ` L${round(x - half * 0.55)} ${round(skirt)}` +
        ` L${round(x - half)} ${round(skirt)} Z`,
    );
  }
  return parts.join(' ');
}

/** Standing stones: three leaning slabs, the tallest in the middle. */
function monoliths(next: () => number, cx: number, height: number): string {
  const parts: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const x = cx + (index - 1) * 11;
    const tall = height * (index === 1 ? 1 : 0.52 + next() * 0.25);
    const lean = (next() - 0.5) * 4;
    parts.push(
      `M${round(x - 5)} ${H}` +
        ` L${round(x - 3.4 + lean)} ${round(H - tall)}` +
        ` L${round(x + 3.4 + lean)} ${round(H - tall + 2.5)}` +
        ` L${round(x + 5)} ${H} Z`,
    );
  }
  return parts.join(' ');
}

/** A battlemented run, drawn from a point already sitting at `(x0, top)`. */
function crenellate(
  x0: number,
  x1: number,
  top: number,
  rise: number,
  teeth: number,
): string {
  const span = (x1 - x0) / (teeth * 2 - 1);
  let d = '';
  for (let index = 0; index < teeth; index += 1) {
    const x = x0 + index * span * 2;
    d +=
      ` L${round(x)} ${round(top - rise)}` +
      ` L${round(x + span)} ${round(top - rise)}` +
      ` L${round(x + span)} ${round(top)}`;
  }
  return `${d} L${round(x1)} ${round(top)}`;
}

/**
 * A keep: a battlemented wall with a tower at one end of it.
 *
 * The one form here with a straight top edge, and that is why it is here --
 * three of the four are pointed, and against a ridgeline of triangles a
 * horizontal silhouette is the thing that reads as built rather than grown.
 */
function keep(next: () => number, cx: number, height: number): string {
  const towerOnRight = next() > 0.5;
  const wallTop = H - height * (0.48 + next() * 0.14);
  const towerTop = H - height;
  const left = cx - 21;
  const right = cx + 21;
  const split = towerOnRight ? right - 14 : left + 14;

  return towerOnRight
    ? `M${round(left)} ${H} L${round(left)} ${round(wallTop)}` +
        crenellate(left, split, wallTop, 3.5, 4) +
        ` L${round(split)} ${round(towerTop)}` +
        crenellate(split, right, towerTop, 3.5, 2) +
        ` L${round(right)} ${H} Z`
    : `M${round(left)} ${H} L${round(left)} ${round(towerTop)}` +
        crenellate(left, split, towerTop, 3.5, 2) +
        ` L${round(split)} ${round(wallTop)}` +
        crenellate(split, right, wallTop, 3.5, 4) +
        ` L${round(right)} ${H} Z`;
}

/**
 * The vista for one seed.
 *
 * @param seed Anything stable that identifies the subject. The apps pass a game
 * urn, so the same title draws the same landscape in the Astro shop and in the
 * Next one.
 */
export function boxArtScene(seed: string): BoxArtScene {
  const next = random(hash(seed));
  // Its own stream, off its own hash. Drawn from the shared one it followed
  // whatever the ridges happened to consume, and eight of the twelve catalogue
  // titles came out with the same form standing in front of them.
  const pick = random(hash(`${seed} foreground`));

  // The horizon sits below the middle: most of the tile is sky, which is where
  // the palette's colour lives and what a card reads as art from across a room.
  const horizon = round(H * (0.52 + next() * 0.14));
  const lightX = 0.16 + next() * 0.68;
  const discR = round(7 + next() * 8);
  const disc = {
    cx: round(W * lightX),
    cy: round(horizon - 4 - next() * 14),
    r: discR,
  };

  const count = 3 + Math.floor(next() * 2);
  const spread = (H - horizon) / (count + 1);
  const ridges: BoxArtRidge[] = [];
  for (let index = 0; index < count; index += 1) {
    const baseY = round(horizon + index * spread);
    const crest = ridge(
      next,
      baseY,
      32 - index * 6,
      5 + index + Math.floor(next() * 3),
    );
    ridges.push({
      crest,
      depth: index as BoxArtDepth,
      fill: `${crest} L${W} ${H} L0 ${H} Z`,
    });
  }

  // Away from the light, so the solid form is backlit rather than washed out --
  // which is the one place this composition gets its depth from for free.
  const foreX = round(
    W * (lightX > 0.5 ? 0.1 + pick() * 0.16 : 0.74 + pick() * 0.16),
  );
  const foreHeight = round(H - horizon + 16 + pick() * 26);
  const kind = Math.floor(pick() * 4);
  const foreground =
    kind === 0
      ? spire(foreX, foreHeight)
      : kind === 1
        ? conifers(pick, foreX, foreHeight, 3 + Math.floor(pick() * 3))
        : kind === 2
          ? monoliths(pick, foreX, foreHeight * 0.7)
          : keep(pick, foreX, foreHeight * 0.66);

  return {
    disc,
    foreground,
    horizon: `${round((horizon / H) * 100)}%`,
    light: {
      x: `${round(lightX * 100)}%`,
      y: `${round((disc.cy / H) * 100)}%`,
    },
    ridges,
  };
}
