import { URN } from '@evanion/urn';

/** Entity identity for a catalogue game, e.g. `urn:game:wingspan`. */
export class GameURN extends URN {
  static override readonly nid = 'game';
}
