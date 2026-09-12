/**
 * WCAG 2.1 relative luminance and contrast, over sRGB hex strings.
 *
 * Here rather than in the test file because three test files need it and because
 * the floors in the token modules are only claims until something computes them.
 * Not exported from `./tokens`: a consumer needs the values and the floors, not
 * the arithmetic that checked them.
 */

/** The sRGB transfer function, inverted, per WCAG 2.1 relative luminance. */
function channel(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match?.[1]) {
    throw new Error(`not a six-digit hex colour: ${hex}`);
  }

  const value = Number.parseInt(match[1], 16);

  return (
    0.2126 * channel((value >> 16) & 0xff) +
    0.7152 * channel((value >> 8) & 0xff) +
    0.0722 * channel(value & 0xff)
  );
}

/** Contrast ratio between two colours, 1 to 21, order-independent. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (one, other) => other - one,
  ) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}
