/**
 * Turning catalogue data into the things the visual system needs: a hue, a
 * label, a price, a number of filled ramp cells.
 *
 * No colour value appears here. A mechanism resolves to a CSS custom-property
 * *reference*, so the hues stay in baize.css and there is no second table in
 * TypeScript to keep in step with it.
 */
import type { Availability, Game } from './shop-api.js';

/** Price formatter for the catalogue currency. Built once; it is not cheap. */
const PRICE = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
});

/** What a reader calls each availability state. */
const AVAILABILITY_LABEL: Record<Availability, string> = {
  'in-stock': 'in stock',
  preorder: 'preorder',
  'reprint-pending': 'reprint pending',
  'out-of-print': 'out of print',
};

/** The urn path segment a mechanism is browsable under. */
export function mechanismSlug(mechanism: string): string {
  return mechanism.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * A CSS value resolving to the mechanism's hue, with the categorical fallback
 * for a mechanism baize.css has no colour for.
 *
 * The fallback is the reason this returns a `var()` chain rather than a hex: a
 * new mechanism in the catalogue gets a defined colour by adding one token, and
 * reads as uncategorised until someone does.
 */
export function mechanismHue(mechanism: string | undefined): string {
  if (!mechanism) return 'var(--mechanism-default)';
  return `var(--mechanism-${mechanismSlug(mechanism)}, var(--mechanism-default))`;
}

/** The hue a game is titled in: its first, most characteristic mechanism. */
export function gameHue(game: Pick<Game, 'mechanisms'>): string {
  return mechanismHue(game.mechanisms[0]);
}

/** A CSS value resolving to an availability state's colour. */
export function availabilityColour(availability: Availability): string {
  return `var(--state-${availability})`;
}

export function availabilityLabel(availability: Availability): string {
  return AVAILABILITY_LABEL[availability] ?? availability;
}

export function formatPrice(minorUnits: number): string {
  return PRICE.format(minorUnits / 100);
}

/** Weight as the stat line shows it: one decimal, against the scale's top. */
export function formatWeight(weight: number): string {
  return `${weight.toFixed(1)} / 5`;
}

/**
 * How many of the ramp's five cells a weight fills.
 *
 * Rounded up, so 2.4 fills three: the last cell stands for the part of a step
 * the game is into, and a heavier game never shows fewer cells than a lighter
 * one.
 */
export function weightSteps(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  return Math.min(Math.ceil(weight), 5);
}

/** Every mechanism in the catalogue, in catalogue order, without repeats. */
export function mechanisms(games: readonly Game[]): string[] {
  const seen = new Set<string>();
  for (const game of games) {
    for (const mechanism of game.mechanisms) seen.add(mechanism);
  }
  return [...seen];
}

/** The games browsable under one mechanism slug. */
export function gamesByMechanism(games: readonly Game[], slug: string): Game[] {
  return games.filter((game) =>
    game.mechanisms.some((mechanism) => mechanismSlug(mechanism) === slug),
  );
}
