/**
 * The two families, as stacks. Bricolage Grotesque for titles, for its width and
 * optical-size axes; Public Sans for text and data. Not Inter.
 *
 * The font files are not shipped. Each app loads them its own way -- `next/font`
 * in the Next apps, Astro's font handling in the storefront, a Vite-resolved
 * `@font-face` in admin -- and a library shipping `@font-face` with its own URLs
 * would fight all three. These values are what the design asks for; nothing here
 * can observe what an app loaded.
 */
export const type = {
  title: "'Bricolage Grotesque', 'Arial Narrow', ui-sans-serif, sans-serif",
  text: "'Public Sans', ui-sans-serif, system-ui, sans-serif",
} as const;

export type TypeToken = keyof typeof type;

/**
 * The type scale, in rem so that it follows the reader's own font size. One of
 * the two apps that built a scale built it in px, which does not.
 */
export const text = {
  xs: '0.75rem',
  sm: '0.8125rem',
  base: '0.9375rem',
  md: '1.125rem',
  lg: '1.5rem',
  xl: '2.25rem',
  '2xl': '3.375rem',
} as const;

export type TextToken = keyof typeof text;

/**
 * Tracking runs opposite by size. Negative on heavy display type, where the
 * default spacing reads loose, and positive on small uppercase labels, where it
 * reads cramped.
 */
export const tracking = {
  tight: '-0.03em',
  snug: '-0.015em',
  normal: '0',
  loose: '0.04em',
} as const;

export type TrackingToken = keyof typeof tracking;

/** Line height by role: display, headings, prose. */
export const leading = {
  tight: '1.05',
  snug: '1.3',
  normal: '1.6',
} as const;

export type LeadingToken = keyof typeof leading;
