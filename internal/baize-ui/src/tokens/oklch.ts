/**
 * OKLCH hue, over sRGB hex strings.
 *
 * Here rather than in the test file for the reason `contrast.ts` gives: the
 * spacing a token module claims for its hues is a claim until something
 * computes it. Not exported from `./tokens` -- a consumer needs the values, not
 * the arithmetic that checked them.
 *
 * Hue is read back off the committed hex rather than kept as the angle the
 * value was derived from, because a hue at the edge of the sRGB gamut is
 * clipped when it is quantised to eight bits per channel, and the clipped
 * colour is the one a reader sees.
 */

/** The sRGB transfer function, inverted. */
function channel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** The OKLCH hue angle of a `#rrggbb` colour, in degrees from 0 to 360. */
export function oklchHue(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match?.[1]) {
    throw new Error(`not a six-digit hex colour: ${hex}`);
  }

  const value = Number.parseInt(match[1], 16);
  const red = channel(((value >> 16) & 0xff) / 255);
  const green = channel(((value >> 8) & 0xff) / 255);
  const blue = channel((value & 0xff) / 255);

  const long = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  );
  const medium = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  );
  const short = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  );

  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const b = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
  const degrees = (Math.atan2(b, a) * 180) / Math.PI;

  return degrees < 0 ? degrees + 360 : degrees;
}

/** The shorter way round the wheel between two hue angles, 0 to 180. */
export function hueSeparation(one: number, other: number): number {
  const difference = Math.abs(one - other) % 360;

  return Math.min(difference, 360 - difference);
}
