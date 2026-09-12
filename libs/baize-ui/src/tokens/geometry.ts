/**
 * Radii by role rather than one radius everywhere: the role is what a reader
 * recognises a chip by before reading it.
 */
export const radius = {
  chip: '3px',
  button: '6px',
  card: '12px',
} as const;

export type RadiusToken = keyof typeof radius;

/**
 * An eight-step spacing scale, in rem. Every gap, padding and margin in
 * `styles.css` comes from here, which is what keeps two components that sit
 * beside each other on the same rhythm.
 */
export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.5rem',
  6: '2rem',
  7: '3rem',
  8: '4rem',
} as const;

export type SpaceToken = keyof typeof space;

/** The line length prose is held to. */
export const measure = '64ch';

/**
 * A black elevation plus a tinted glow at 4%. The glow is what keeps a raised
 * surface on a chromatic ground from reading as a grey card dropped onto green.
 */
export const elevation = {
  card: '0 1px 0 rgb(0 0 0 / 0.35), 0 14px 28px -18px rgb(0 0 0 / 0.75), 0 0 24px -12px rgb(143 166 158 / 0.04)',
  raised: '0 1px 0 rgb(0 0 0 / 0.3), 0 6px 14px -10px rgb(0 0 0 / 0.6)',
} as const;

export type ElevationToken = keyof typeof elevation;

/**
 * Motion is interaction-only: one duration and one easing, spent on hover and
 * focus and on nothing that moves by itself. `styles.css` drops both under
 * `prefers-reduced-motion`.
 */
export const motion = {
  duration: '120ms',
  easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
} as const;

export type MotionToken = keyof typeof motion;
