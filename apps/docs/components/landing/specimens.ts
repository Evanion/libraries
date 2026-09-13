/**
 * One line of what a package produces, for the card that sells it.
 *
 * A description says what a library is for; a specimen shows the thing itself.
 * `urn:user:1337` is the whole of what a URN is, and a reader who has seen one
 * knows whether it is what they came for before reading a sentence.
 *
 * Each specimen is segments so the card can set the part that matters in the
 * package's own colour: the namespace of a URN, the check character Luhn
 * appended, the check character at the end of a token. `dim` is scaffolding the
 * eye should read past.
 *
 * Every value here is one the package's own README states and runs as a test,
 * and `specimens.test.ts` runs the packages against these strings too, so the
 * line on the card is a value the package produced rather than one somebody
 * typed. Keyed by the package's slug in `app/navigation.ts`; a package with no
 * entry has no specimen line, which is right for one whose output is not a
 * string.
 */
export interface SpecimenSegment {
  text: string;
  role: 'plain' | 'mark' | 'dim';
}

export const specimens: Readonly<Record<string, readonly SpecimenSegment[]>> = {
  urn: [
    { text: 'urn:', role: 'dim' },
    { text: 'user', role: 'mark' },
    { text: ':', role: 'dim' },
    { text: '1337', role: 'plain' },
  ],
  luhn: [
    { text: 'foo', role: 'plain' },
    { text: '5', role: 'mark' },
  ],
  token: [
    { text: 'a4kp-9mx', role: 'plain' },
    { text: 'a', role: 'mark' },
  ],
};

/** The specimen as the one string the package produced. */
export function specimenText(segments: readonly SpecimenSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}
