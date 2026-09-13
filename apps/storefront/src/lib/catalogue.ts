/**
 * Turning catalogue data into what the design system takes: a mechanism, an
 * availability state, a ramp stop, a box-art palette, a price, a complexity.
 *
 * `@evanion/baize-ui` takes enum members and already-formatted strings, so this
 * is where the catalogue's own vocabulary is translated into the library's.
 * Nothing here names a colour: the hues, the states and the gradients live in the
 * library's token modules, and a class name resolved here is resolved by the
 * library's own resolvers.
 *
 * The mapping is catalogue data and belongs to the app. A mechanism the catalogue
 * starts carrying is an entry in `MECHANISMS` below, reviewed against the
 * library's contrast floor, and renders as `other` until someone adds it.
 */
import {
  hueClass,
  paletteClass,
  stateClass,
  type Availability as BaizeAvailability,
  type BoxArtPalette,
  type Mechanism,
  type ComplexityStop,
} from '@evanion/baize-ui/tokens';

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

/**
 * The catalogue's availability states, as the design system's.
 *
 * Two spellings of one set, and deliberately so: the API's wire format is
 * hyphenated and the library's enum is camel-cased, and a function deriving one
 * from the other would turn a renamed state into a silent fallback instead of a
 * type error.
 */
const AVAILABILITY: Record<Availability, BaizeAvailability> = {
  'in-stock': 'inStock',
  preorder: 'preorder',
  'reprint-pending': 'reprintPending',
  'out-of-print': 'outOfPrint',
};

/**
 * The mechanism families the hue scale covers, keyed by catalogue slug.
 *
 * Partial on purpose: the catalogue's vocabulary is open — `legacy`,
 * `asymmetric powers`, `farming` — and the library has one hue for everything
 * outside its eight families. A mechanism absent here reads as uncategorised
 * rather than borrowing another family's colour.
 */
const MECHANISMS: Readonly<Record<string, Mechanism>> = {
  'engine-building': 'engineBuilding',
  economic: 'economic',
  'co-op': 'cooperative',
  'tile-placement': 'tilePlacement',
  'worker-placement': 'workerPlacement',
  deckbuilder: 'deckbuilder',
  'area-control': 'areaControl',
  dexterity: 'dexterity',
};

/**
 * Which gradient palette stands in for each box, keyed by the game urn's nss.
 *
 * Catalogue data, which is why it is here and not in the library: a palette is
 * named after a pigment and the shop decides which box it approximates. Each one
 * is picked for the colours the real box is printed in — Azul's glazed tiles are
 * `cobalt`, Crokinole's bare board is `oak` — so a grid with no photography still
 * reads as a shelf of different games.
 *
 * A game absent here paints the neutral gradient, which is what the whole
 * catalogue looked like before anyone mapped it.
 */
const BOX_ART: Readonly<Record<string, BoxArtPalette>> = {
  wingspan: 'sky',
  'brass-birmingham': 'soot',
  gloomhaven: 'garnet',
  azul: 'cobalt',
  viticulture: 'terracotta',
  dominion: 'olive',
  root: 'rust',
  'ark-nova': 'verdant',
  'flamme-rouge': 'vermilion',
  crokinole: 'oak',
  'spirit-island': 'indigo',
  agricola: 'loam',
};

/** The urn path segment a mechanism is browsable under. */
export function mechanismSlug(mechanism: string): string {
  return mechanism.trim().toLowerCase().replace(/\s+/g, '-');
}

/** The hue family a mechanism belongs to, or `other` for one with no family. */
export function mechanismToken(mechanism: string | undefined): Mechanism {
  if (!mechanism) return 'other';
  return MECHANISMS[mechanismSlug(mechanism)] ?? 'other';
}

/** The class that binds a mechanism's hue for everything under the element. */
export function mechanismHueClass(mechanism: string | undefined): string {
  return hueClass(mechanismToken(mechanism));
}

/**
 * The hue class a game's title and tags take: its first, most characteristic
 * mechanism.
 */
export function gameHueClass(game: Pick<Game, 'mechanisms'>): string {
  return mechanismHueClass(game.mechanisms[0]);
}

/** The class that binds an availability state's colour for the pill. */
export function availabilityStateClass(availability: Availability): string {
  return stateClass(AVAILABILITY[availability]);
}

export function availabilityLabel(availability: Availability): string {
  return AVAILABILITY_LABEL[availability] ?? availability;
}

/**
 * The class that paints a game's box-art gradient, or nothing for a game no one
 * has mapped.
 */
export function boxArtPaletteClass(urn: string): string | undefined {
  const palette = BOX_ART[urn.replace(/^urn:game:/, '')];
  return palette && paletteClass(palette);
}

export function formatPrice(minorUnits: number): string {
  return PRICE.format(minorUnits / 100);
}

/** Complexity as the stat line shows it: one decimal, against the scale's top. */
export function formatComplexity(complexity: number): string {
  return `${complexity.toFixed(1)} / 5`;
}

/**
 * Which stop on the five-stop ramp a complexity reaches, or nothing for an unrated
 * game.
 *
 * Rounded up, so 2.4 reaches stop 3: the last filled pip stands for the part of
 * a step the game is into, and a heavier game never shows fewer pips than a
 * lighter one.
 */
export function complexityStop(complexity: number): ComplexityStop | undefined {
  if (!Number.isFinite(complexity) || complexity <= 0) return undefined;
  return Math.min(5, Math.ceil(complexity)) as ComplexityStop;
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
