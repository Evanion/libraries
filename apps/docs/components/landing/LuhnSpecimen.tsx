'use client';

import { Luhn } from '@evanion/luhn';
import { useId, useState } from 'react';
import { useSettled } from './settle';
import { luhnCheck } from './specimens';

/**
 * Text a reader can change, and the check character the package appends to
 * it, recomputed on every keystroke.
 *
 * The field is the specimen: the same size, the same field of the package's
 * hue, with a hairline under the text to say it can be typed in. No label
 * box, no button, because the check character updating as the reader types
 * is the whole demonstration. `Luhn.generate` folds over the dictionary's
 * code points and drops the rest, so `FoO-ö` and `foo` produce the same
 * character, which a reader can see for themselves.
 *
 * The character settles rather than snaps: for 200ms after a keystroke it
 * turns through the dictionary before landing, which is what computing
 * something looks like, and turns through the dictionary rather than any
 * glyph so the alphabet shows itself in passing. What a screen reader gets
 * is the `<output>`, which only ever holds the real character; the turning
 * span is hidden from it.
 */
export default function LuhnSpecimen({ initial }: { initial: string }) {
  const [body, setBody] = useState(initial);
  const id = useId();
  const check = luhnCheck(body);
  const shown = useSettled(check, Luhn.dictionary);

  return (
    <p className="landing-specimen landing-specimen--live">
      {/* The field is sized by a hidden copy of its text in the same cell,
          so the check character sits right after the last letter in a
          proportional face, where `size` would leave a gap of averages. */}
      <span className="landing-specimen__field">
        <span className="landing-specimen__mirror" aria-hidden="true">
          {body || ' '}
        </span>
        <input
          id={id}
          className="landing-specimen__input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Text to append a check character to"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </span>
      <span className="landing-specimen__mark" aria-hidden="true">
        {shown ?? ''}
      </span>
      <output htmlFor={id} className="landing-sr-only" aria-live="polite">
        {check ?? ''}
      </output>
      {check === undefined ? (
        <span className="landing-specimen__hint">
          nothing from the alphabet yet
        </span>
      ) : null}
    </p>
  );
}
