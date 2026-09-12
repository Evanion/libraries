/**
 * The table surface. Six values, chromatic rather than tinted black, because the
 * subject is baize.
 *
 * These are the values `docs/specs/2026-09-10-demo-apps.md` settles, quoted
 * exactly. `ground.test.ts` asserts each one against that document, so a hex
 * edited here fails naming the token.
 */
export const ground = {
  /** Page. */
  ink: '#0C1714',
  /** Panels, cards, anything raised off the page. */
  felt: '#142521',
  /** Hairlines. */
  rule: '#2A3F39',
  /** Primary text. Warm: rulebook paper rather than `#fff`. */
  chalk: '#F2EDE3',
  /** Secondary text. */
  lichen: '#8FA69E',
  /** Tertiary text. */
  moss: '#5E736C',
} as const;

export type GroundToken = keyof typeof ground;
