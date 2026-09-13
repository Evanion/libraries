import { ground } from '@evanion/baize-ui/tokens';

/**
 * The Baize tokens in the shapes Nextra's `<Head>` takes.
 *
 * Nextra owns the shell -- the sidebar, the search UI, the colour-scheme class
 * `next-themes` writes onto `<html>` from a blocking script -- and exposes its
 * theme through three things: `--nextra-bg` as an `r,g,b` triple, an HSL primary
 * in three separate properties, and the Tailwind v4 `--x-*` scale its components
 * are built on. The first two are set through `<Head>` props rather than
 * overridden in CSS: the component writes them into an inline `<style>` in the
 * document, which wins over any stylesheet link whatever we declare. `global.css`
 * maps the third.
 *
 * Derived from the token values rather than retyped, so a ground hex changing in
 * the library reaches this site without anyone remembering to come here.
 */

/** A `#rrggbb` colour as hue in degrees, saturation and lightness in percent. */
function hsl(hex: string): {
  hue: number;
  saturation: number;
  lightness: number;
} {
  const value = Number.parseInt(hex.slice(1), 16);
  const [red, green, blue] = [
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  ] as [number, number, number];

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const span = max - min;
  const lightness = (max + min) / 2;

  if (span === 0) return { hue: 0, saturation: 0, lightness: lightness * 100 };

  const saturation = span / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === red
      ? ((green - blue) / span + (green < blue ? 6 : 0)) * 60
      : max === green
        ? ((blue - red) / span + 2) * 60
        : ((red - green) / span + 4) * 60;

  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}

/**
 * The accent, taken from `lichen`.
 *
 * Baize has no house colour: the catalogue supplies every saturated pixel and
 * this site sells nothing, so there is no brand hue to give Nextra. `lichen` is
 * the secondary text colour, which makes the accent the ground's own hue at the
 * ground's own low chroma rather than a colour introduced for the purpose.
 *
 * Lightness is the one value not taken from the token. `lichen` sits where it
 * does to be legible on `felt`; on the light theme's parchment the same hue has
 * to come down to stay legible, and Nextra draws the accent as link and
 * active-item text in both.
 */
const accent = hsl(ground.lichen);

export const baizeColor = {
  hue: accent.hue,
  saturation: accent.saturation,
  lightness: { dark: accent.lightness, light: 32 },
};

/**
 * The page ground in each theme.
 *
 * Nextra keeps its light/dark toggle and this site keeps both, so both need a
 * ground. Dark is `ink`, the table itself. Light is `chalk`, which is the
 * design's warm rulebook paper rather than `#fff` -- a light Baize is not
 * something the design document settles, and the parchment the chalk token
 * already names is the nearest thing it does settle.
 */
export const baizeBackground = { dark: ground.ink, light: ground.chalk };
