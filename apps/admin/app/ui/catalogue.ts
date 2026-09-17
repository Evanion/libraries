/**
 * Turning shelf data into what `@evanion/baize-ui` takes, and loading the two
 * families it names.
 *
 * The design system itself is the library. What is left here is the back office's
 * own vocabulary -- the states a merchant declares, the complexity tiers a buyer
 * reads a shelf by -- mapped onto the library's enums. Nothing here names a colour,
 * a radius or a type size: the app had its own copy of all three and that copy is
 * what the library exists to remove.
 *
 * No mechanism mapping, because the back office paints no mechanism hue: the colour
 * ladder carries complexity and a mechanism reaches a page as its name.
 */
import { complexityTier } from '@evanion/baize-ui/tokens';
import type {
  Availability as BaizeAvailability,
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
 * The shop's wording, as shop-api spells the same four states.
 *
 * The access matrix restricts a written `availability` to the catalogue's own
 * tokens through a `targets` list, and the catalogue hyphenates where the back
 * office prints a space. A proposed write is therefore translated before a
 * decision reads it, or every declaration a merchant makes lands as
 * `targets-failed`.
 *
 * Written out for the reason `AVAILABILITY` is: a state either side renames is a
 * type error here rather than a refusal a merchant reads as a permissions bug.
 */
const CATALOGUE_AVAILABILITY: Record<Availability, string> = {
  'in stock': 'in-stock',
  preorder: 'preorder',
  'reprint pending': 'reprint-pending',
  'out of print': 'out-of-print',
};

/** The catalogue token for a state the availability form posts. */
export function catalogueAvailability(availability: Availability): string {
  return CATALOGUE_AVAILABILITY[availability];
}

/** The state token a pill takes. */
export function availabilityToken(
  availability: Availability,
): BaizeAvailability {
  return AVAILABILITY[availability];
}

/**
 * Which stop on the five-stop ramp a rating reaches.
 *
 * The stop comes from the tier rather than from rounding the rating: one tier per
 * stop, so the ramp, the word and the colour a title is set in can never disagree.
 * Rounding put nine of the twelve catalogue titles on two stops and never reached
 * the first or the last.
 */
export function complexityStop(complexity: number): ComplexityStop {
  return complexityTier(complexity).stop;
}

/**
 * The tier a rating falls in: `Gateway`, `Brain-burner`.
 *
 * A buyer reading a shelf wants the word, and the word is also what keeps the
 * ladder off colour alone. The number stays beside it in every cell that shows one,
 * because the difference between two Heavy titles is the whole reason to buy one.
 */
export function complexityTierName(complexity: number): string {
  return complexityTier(complexity).name;
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
