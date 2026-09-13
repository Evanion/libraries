/**
 * Turning catalogue data into what `@evanion/baize-ui` takes.
 *
 * The library takes enum members and already-formatted strings, so this is the one
 * place the catalogue's vocabulary becomes the design system's. Nothing here names
 * a colour: the hues, the states and the gradients are the library's tokens.
 *
 * The mapping is catalogue data and belongs to the app, the same way it does in
 * `apps/storefront`. Each app declares its own because each has its own response
 * types -- the HTTP contract is the boundary between this app and shop-api, and a
 * shared types package between two demo apps would hide a breaking change behind a
 * compile that still passes.
 */
import { complexityTier } from '@evanion/baize-ui/tokens';
import type {
  Availability as BaizeAvailability,
  BoxArtPalette,
  ComplexityStop,
  Mechanism,
} from '@evanion/baize-ui';

import type { Availability } from './shop-api';

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
 * Two spellings of one set, written out rather than derived: the wire format is
 * hyphenated and the library's enum is camel-cased, and a function converting one
 * to the other would turn a renamed state into a silent fallback instead of a type
 * error.
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
 * Partial on purpose: the catalogue's vocabulary is open — `legacy`, `racing`,
 * `farming` — and the library has one hue for everything outside its eight
 * families, so an unlisted mechanism reads as uncategorised rather than borrowing
 * another family's colour.
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
 * Each one is picked for the colours the real box is printed in — Azul's glazed
 * tiles are `cobalt`, Crokinole's bare board is `oak` — so a page with no
 * photography reads as a shelf of different games. A game absent here paints the
 * neutral gradient.
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

/** The hue family a mechanism belongs to, or `other` for one with no family. */
export function mechanismToken(mechanism: string | undefined): Mechanism {
  if (!mechanism) return 'other';
  return (
    MECHANISMS[mechanism.trim().toLowerCase().replace(/\s+/g, '-')] ?? 'other'
  );
}

/** The state the pill takes. */
export function availabilityToken(
  availability: Availability,
): BaizeAvailability {
  return AVAILABILITY[availability];
}

/** The state as the shop words it. */
export function availabilityLabel(availability: Availability): string {
  return AVAILABILITY_LABEL[availability] ?? availability;
}

/** The palette a game's box art is painted in, or none for one nobody mapped. */
export function boxArtPalette(urn: string): BoxArtPalette | undefined {
  return BOX_ART[urn.replace(/^urn:game:/, '')];
}

/**
 * Where a photographed box lives, and which titles have been photographed.
 *
 * Nothing yet, which is the state this is built for rather than a gap in it: the
 * tile paints a photograph as a CSS background layer over the generated vista,
 * so a title listed here whose file has not landed shows the vista and a title
 * not listed here never asks for a file at all.
 *
 * The same list as `apps/storefront`'s, declared separately for the same reason
 * every other mapping in this file is: each app owns its own catalogue data, and
 * a shared package between two demo apps would hide a breaking change behind a
 * compile that still passes.
 */
const BOX_ART_PHOTOS = 'https://docs.evanion.com/box-art';
const PHOTOGRAPHED: ReadonlySet<string> = new Set<string>();

/** The photograph of a game's box, for the titles that have one. */
export function boxArtPhotoUrl(urn: string): string | undefined {
  const slug = urn.replace(/^urn:game:/, '');
  return PHOTOGRAPHED.has(slug) ? `${BOX_ART_PHOTOS}/${slug}.webp` : undefined;
}

export function formatPrice(minorUnits: number): string {
  return PRICE.format(minorUnits / 100);
}

/** The rating as the stat line shows it: one decimal, against the scale's top. */
export function formatComplexity(complexity: number): string {
  return `${complexity.toFixed(1)} / 5`;
}

/**
 * Which stop on the five-stop ramp a rating reaches.
 *
 * The stop comes from the tier rather than from rounding the rating: one tier per
 * stop, so the colour the title is set in and the word under it can never
 * disagree. Rounding put nine of the twelve catalogue titles on two stops and
 * never reached the first or the last.
 */
export function complexityStop(complexity: number): ComplexityStop {
  return complexityTier(complexity).stop;
}

/**
 * The tier a rating falls in, as a shopper reads it: `Gateway`, `Brain-burner`.
 *
 * The word leads the stat cell and the number follows it in the label, because
 * `2.4 / 5` is BoardGameGeek's measure of rules overhead and means nothing until
 * you have learnt the scale -- and because colour cannot be the only thing
 * separating a Gateway game from a Heavy one.
 */
export function complexityTierName(complexity: number): string {
  return complexityTier(complexity).name;
}
