/**
 * The contrast floor every complexity stop is held to, against `felt`.
 *
 * 4.5:1, WCAG AA for normal text, because the ladder paints a game's title. A
 * card title is `text-md` at 700 -- 18px bold, which is 13.5pt and so under the
 * 14pt-bold threshold the 3:1 large-text allowance needs. The pips take the same
 * stops and a 3px graphic only needs 3:1, so holding the text floor covers both.
 */
export const COMPLEXITY_CONTRAST_FLOOR = 4.5;

/**
 * Five stops, most recessive first. The only saturated informational ramp in the
 * system.
 *
 * Complexity is ordinal, so the ramp is sequential: lightness and chroma both
 * rise with the stop, and the hue turns from olive towards amber as they do. One
 * direction, three channels agreeing -- a Gateway title is a quiet dust colour
 * against the felt and a Brain-burner's is hot brass, and the order reads without
 * a legend.
 *
 * Saturated rather than neutral, because this ladder is the card's one colour
 * signal. Mechanism no longer tints a game's title or its tags, so there is no
 * second informational hue for this one to be confused with; a neutral ramp here
 * would read as type greyed out rather than as a scale.
 *
 * Amber rather than green or blue: felt is a green table and the availability
 * pills are green, blue and grey-green, so the warm family is the one nothing
 * else on a card occupies.
 */
export const complexity = {
  1: '#908B75',
  2: '#A89B72',
  3: '#C5A96A',
  4: '#E4B665',
  5: '#FEC57E',
} as const;

/** A stop on the complexity ramp. Ordinal, 1 to 5. */
export type ComplexityStop = keyof typeof complexity;

/** One tier of the published scale: a name, a stop, and where it starts. */
export interface ComplexityTier {
  /** The ramp stop the tier paints. One tier per stop, five of each. */
  stop: ComplexityStop;
  /** What a reader sees. BoardGameGeek's vocabulary for rules overhead. */
  name: string;
  /**
   * The lowest rating the tier covers. A tier runs from its own floor up to the
   * next one's, the last one to the top of the scale.
   */
  floor: number;
}

/**
 * The five tiers, shallowest first.
 *
 * Words rather than a bare `2.4 / 5`, because the number is BoardGameGeek's
 * measure of rules overhead and means nothing to a shopper who has not learnt the
 * scale. The tier also carries what the colour carries, which is what keeps the
 * ladder out of WCAG 1.4.1: a reader who sees no hue difference still reads
 * `Gateway` and `Brain-burner`.
 *
 * The cutoffs come from the catalogue's own distribution rather than from cutting
 * 1-5 into fifths. Even fifths put nine of the twelve titles in two tiers and
 * left the top and bottom stops unused, and a ramp with three colours in it does
 * not demonstrate a ramp. These five land 1, 2, 3, 3 and 3 titles.
 */
export const complexityTiers: readonly ComplexityTier[] = [
  { stop: 1, name: 'Gateway', floor: 0 },
  { stop: 2, name: 'Light', floor: 1.5 },
  { stop: 3, name: 'Midweight', floor: 2 },
  { stop: 4, name: 'Heavy', floor: 3 },
  { stop: 5, name: 'Brain-burner', floor: 3.9 },
] as const;

/**
 * The tier a rating falls in.
 *
 * Total, and clamped at both ends: the catalogue is the authority on the number,
 * and a rating off the scale -- or no rating at all -- is better shown as the
 * nearest tier than as a thrown error in the middle of a card grid. An app that
 * distinguishes unrated from Gateway checks the rating before asking.
 */
export function complexityTier(rating: number): ComplexityTier {
  if (!Number.isFinite(rating)) return complexityTiers[0] as ComplexityTier;

  let tier = complexityTiers[0] as ComplexityTier;
  for (const candidate of complexityTiers) {
    if (rating >= candidate.floor) tier = candidate;
  }
  return tier;
}
