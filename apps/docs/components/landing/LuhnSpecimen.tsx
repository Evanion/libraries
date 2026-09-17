'use client';

import { Button } from '@evanion/baize-ui';
import { Luhn } from '@evanion/luhn';
import { useId, useState } from 'react';
import { luhnCheck } from './specimens';

/**
 * A code as it was issued, the same code typed back, and the package's verdict
 * on whether they are the same code.
 *
 * Computing a check character is not the point and showing it alone does not
 * teach anything: a reader watches a letter appear and has no reason to want
 * it. The point is the catch. So the card issues a code, hands the reader a
 * field to type it back into, and runs `Luhn.validate` on every keystroke --
 * which is the moment the package exists for, the one where a mistyped code is
 * refused before it reaches a lookup.
 *
 * The two buttons make the two errors a reader would otherwise have to invent.
 * A single wrong character is what a check character always catches; a
 * transposition is the error people actually make reading a code aloud or
 * copying it off a screen, and it is the harder of the two to catch, which is
 * why it is offered rather than left to chance.
 *
 * `Luhn.validate` folds over the dictionary and drops what is not in it, so
 * the separators in a code are ignored rather than refused. The card does not
 * say so: `filtered` is always non-zero for a code with separators, and a line
 * that is always on the screen explains an internal at a reader who did not ask.
 */

/** The next character in the dictionary, so a nudge always changes the code. */
function otherCharacter(char: string): string {
  const index = Luhn.dictionary.indexOf(char.toLowerCase());
  if (index === -1) return Luhn.dictionary[0] as string;
  return Luhn.dictionary[(index + 1) % Luhn.dictionary.length] as string;
}

export default function LuhnSpecimen({ initial }: { initial: string }) {
  const issued = `${initial}${luhnCheck(initial) ?? ''}`;
  const [typed, setTyped] = useState(issued);
  const id = useId();

  const verdict = Luhn.validate(typed);
  const untouched = typed === issued;

  /** Replaces one character, so the code differs by exactly one position. */
  function mistype() {
    const at = Math.max(0, typed.length - 2);
    const char = typed[at] ?? '';
    setTyped(typed.slice(0, at) + otherCharacter(char) + typed.slice(at + 1));
  }

  /**
   * Swaps an adjacent pair, the error people make reading a code aloud.
   *
   * The pair has to differ or the swap changes nothing and the button looks
   * broken, which `foo5` would do to the last two characters before its check.
   * The rightmost differing pair is taken, so the change is near the check
   * character a reader is watching.
   */
  const swapAt = (() => {
    for (let at = typed.length - 2; at >= 0; at -= 1) {
      if (typed[at] !== typed[at + 1]) return at;
    }
    return -1;
  })();

  function swap() {
    if (swapAt === -1) return;
    const [a, b] = [typed[swapAt] ?? '', typed[swapAt + 1] ?? ''];
    setTyped(typed.slice(0, swapAt) + b + a + typed.slice(swapAt + 2));
  }

  return (
    <div className="landing-spec">
      <p className="landing-specimen landing-specimen--live">
        <span className="landing-spec__label">Issued</span>
        <span className="landing-specimen__value" aria-hidden="true">
          {initial}
          <span className="landing-specimen__mark">{luhnCheck(initial)}</span>
        </span>
      </p>

      <div className="landing-spec__row">
        <label className="landing-spec__label" htmlFor={id}>
          Typed back
        </label>
        <span className="landing-specimen__field">
          <span className="landing-specimen__mirror" aria-hidden="true">
            {typed || ' '}
          </span>
          <input
            id={id}
            className="landing-specimen__input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </span>
        <span
          className={
            verdict.isValid
              ? 'landing-luhn__verdict landing-luhn__verdict--accepted'
              : 'landing-luhn__verdict landing-luhn__verdict--rejected'
          }
        >
          {verdict.isValid ? 'accepted' : 'rejected'}
        </span>
      </div>

      <output htmlFor={id} className="landing-sr-only" aria-live="polite">
        {verdict.isValid
          ? `${typed} is accepted.`
          : `${typed} is rejected: this is not the code that was issued.`}
      </output>

      <div className="landing-spec__row">
        <span className="landing-spec__label">Break it</span>
        <Button variant="quiet" onClick={mistype}>
          Change a character
        </Button>
        <Button variant="quiet" onClick={swap} disabled={swapAt === -1}>
          Swap two
        </Button>
        <Button
          variant="quiet"
          onClick={() => setTyped(issued)}
          disabled={untouched}
        >
          Reset
        </Button>
      </div>

      <p className="landing-spec__note">
        {verdict.isValid && untouched
          ? 'The last character is the check. Break the code and it stops matching.'
          : verdict.isValid
            ? 'This one passes too. A check character catches mistakes, not every string.'
            : 'Caught here, before anything looks it up.'}
      </p>
    </div>
  );
}
