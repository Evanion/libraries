/**
 * Turning shelf data into what `@evanion/baize-ui` takes, and loading the two
 * families it names.
 *
 * The design system itself is the library. What is left here is the back office's
 * own vocabulary -- the states a merchant declares, the mechanisms the catalogue
 * carries -- mapped onto the library's enums. Nothing here names a colour, a
 * radius or a type size: the app had its own copy of all three and that copy is
 * what the library exists to remove.
 */
import type {
  Availability as BaizeAvailability,
  Mechanism,
  ComplexityStop,
} from '@evanion/baize-ui';

/**
 * What the shop says about a title.
 *
 * The shop's own wording, which is also the label a pill shows and the value the
 * availability form posts. shop-api models quantity and nothing else, so three of
 * these four have nowhere to come from but a merchant's decision.
 */
export type Availability =
  'in stock' | 'preorder' | 'reprint pending' | 'out of print';

/** The four states, in the order the sidebar and the form list them. */
export const AVAILABILITY_STATES: readonly Availability[] = [
  'in stock',
  'preorder',
  'reprint pending',
  'out of print',
];

/**
 * The shop's wording, as the design system's state tokens.
 *
 * Written out rather than derived: the wording is what a merchant reads and
 * posts, the token is what selects a colour, and a function turning one into the
 * other would make a reworded state a silent fallback instead of a type error.
 */
const AVAILABILITY: Record<Availability, BaizeAvailability> = {
  'in stock': 'inStock',
  preorder: 'preorder',
  'reprint pending': 'reprintPending',
  'out of print': 'outOfPrint',
};

/**
 * The mechanism families the hue scale covers, keyed by catalogue slug.
 *
 * A table rather than the hash this app used to assign hues with. A hash gave
 * every mechanism a stable colour and gave the storefront a different one for the
 * same game, because the two hashed into different palettes -- which is the
 * divergence this adoption is for. Partial on purpose: the catalogue's vocabulary
 * is open and the scale is not, so an unlisted mechanism reads as uncategorised.
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

/** The state token a pill takes. */
export function availabilityToken(
  availability: Availability,
): BaizeAvailability {
  return AVAILABILITY[availability];
}

/** The hue family a mechanism belongs to, or `other` for one with no family. */
export function mechanismToken(mechanism: string | undefined): Mechanism {
  if (!mechanism) return 'other';
  return (
    MECHANISMS[mechanism.trim().toLowerCase().replace(/\s+/g, '-')] ?? 'other'
  );
}

/**
 * Which stop on the five-stop ramp a complexity reaches.
 *
 * Complexity ratings are fractional and the ramp has five stops, so the value is bucketed by
 * its ceiling. Anything outside 1-5 is clamped rather than rejected: the catalogue
 * is the authority on the number, and a ramp that throws is worse than one showing
 * its end.
 */
export function complexityStop(complexity: number): ComplexityStop {
  if (!Number.isFinite(complexity)) return 1;
  return Math.min(5, Math.max(1, Math.ceil(complexity))) as ComplexityStop;
}

/** Complexity as a figure, at the precision the published scale has. */
export function formatComplexity(complexity: number): string {
  return complexity.toFixed(1);
}

/**
 * Stylesheet links for the two families the library names and does not ship.
 *
 * Returned from the root route's `links`. Each app loads the fonts its own way --
 * `next/font` in the two Next apps, `<link>` elements here and in the Astro
 * storefront -- because a library shipping `@font-face` with its own URLs would
 * fight all of them.
 */
export const baizeFontLinks = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous' as const,
  },
  {
    rel: 'stylesheet',
    href:
      'https://fonts.googleapis.com/css2' +
      '?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800' +
      '&family=Public+Sans:wght@300..800' +
      '&display=swap',
  },
];
