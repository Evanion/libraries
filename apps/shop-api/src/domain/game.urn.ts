import { URN } from '@evanion/urn';

/**
 * Entity identity for a catalogue game, e.g. `urn:game:wingspan`.
 *
 * Fixes `nid` -- the URN namespace id that names the resource type -- to
 * `'game'`, so every game urn in the app comes from `GameURN.stringify(nss)`
 * rather than a bare `URN.stringify(nss, 'game')` repeated at each call
 * site. One class per entity type keeps that nid a compile-time constant
 * instead of a string a caller could mistype or swap with OrderURN's.
 */
export class GameURN extends URN {
  static override readonly nid = 'game';
}
