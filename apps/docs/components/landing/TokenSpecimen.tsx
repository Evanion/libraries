'use client';

import { Button } from '@evanion/baize-ui';
import { useId, useMemo, useState } from 'react';
import { useSettled } from './settle';
import {
  buildToken,
  collisionAt,
  shapeLabel,
  tokenAlphabets,
  tokenParts,
  tokenShapes,
} from './specimens';

/** Each character lands this much later than the one before it. */
const STAGGER_MS = 25;

/**
 * A code, the two decisions that shape it, and what those decisions cost.
 *
 * Every code is `generate()` from the published package, drawing from
 * `crypto.getRandomValues` in the reader's browser -- which is why the package
 * moved to Web Crypto. The opening value is the README's specimen, rendered on
 * the server, so the first thing a reader sees is the same on both sides of
 * hydration; the first press replaces it.
 *
 * Length and chunk size are one control rather than two, because the package
 * requires the chunk to divide the length exactly: the pair is a single
 * decision, and every option a reader can reach is one `createToken` accepts.
 * Each option is labelled with its own chunks, so the control reads as the
 * shape the code takes and the last one, chunked at its full length, is the
 * package's way of asking for no separators -- a run with nowhere to pause.
 *
 * The alphabet is the control the library exists for. Two of the three are
 * accepted and move the entropy the caption reports; the third is every
 * lowercase letter and digit, which `createToken` refuses, and the card shows
 * the characters the refusal named rather than a code that could not be
 * minted. The button goes with them, because there is nothing to mint from.
 *
 * A new code lands left to right, each character turning through that
 * alphabet for a moment before it settles, the separator standing still
 * throughout: 200ms for the first character and 25ms more for each after it.
 * The `<output>` is what a screen reader gets, and holds the code, or the
 * refusal, and never a frame of the turning.
 */
export default function TokenSpecimen({ initial }: { initial: string }) {
  const [shape, setShape] = useState(0);
  const [alphabet, setAlphabet] = useState(0);
  const [value, setValue] = useState(initial);
  const id = useId();

  const attempt = useMemo(() => buildToken(shape, alphabet), [shape, alphabet]);
  const built = attempt.kind === 'built' ? attempt.token : undefined;

  // Nothing is shown while a dictionary stands refused, so the settle has no
  // value and no alphabet to turn through until one is accepted again.
  const code = built ? value : '';
  const shown = useSettled(code, built?.dictionary ?? '', STAGGER_MS) ?? code;
  const { body, check } = tokenParts(shown);

  /**
   * Moves one control and mints a code for where both now stand.
   *
   * The code in hand has the old shape, so it cannot survive the change; a
   * refused alphabet mints nothing and the reader keeps the code they had for
   * whenever they come back to an accepted one.
   */
  function choose(next: { shape?: number; alphabet?: number }) {
    const chosen = next.shape ?? shape;
    const drawnFrom = next.alphabet ?? alphabet;
    const attempted = buildToken(chosen, drawnFrom);

    setShape(chosen);
    setAlphabet(drawnFrom);
    if (attempted.kind === 'built') setValue(attempted.token.generate().value);
  }

  return (
    <div className="landing-spec">
      <p className="landing-specimen landing-specimen--live">
        {attempt.kind === 'built' ? (
          <span className="landing-specimen__value" aria-hidden="true">
            {body}
            <span className="landing-specimen__mark">{check}</span>
          </span>
        ) : (
          <span
            className="landing-specimen__value landing-token__refused"
            aria-hidden="true"
          >
            {attempt.offending.map((char) => (
              <span key={char} className="landing-token__offending">
                {char}
              </span>
            ))}
          </span>
        )}
        <output className="landing-sr-only" aria-live="polite">
          {attempt.kind === 'built'
            ? value
            : `Refused: ${attempt.offending.join(', ')}`}
        </output>
        {built ? (
          <span className="landing-specimen__action">
            <Button
              variant="quiet"
              onClick={() => setValue(built.generate().value)}
            >
              Generate
            </Button>
          </span>
        ) : null}
      </p>

      <div className="landing-spec__row">
        <span className="landing-spec__label" id={`${id}-shape`}>
          Say it as
        </span>
        <div
          className="landing-seg"
          role="group"
          aria-labelledby={`${id}-shape`}
        >
          {tokenShapes.map((option, index) => (
            <label key={shapeLabel(option)} className="landing-seg__option">
              <input
                className="landing-sr-only"
                type="radio"
                name={`${id}-shape-option`}
                checked={shape === index}
                onChange={() => choose({ shape: index })}
              />
              <span className="landing-seg__face">{shapeLabel(option)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="landing-spec__row">
        <span className="landing-spec__label" id={`${id}-alphabet`}>
          Drawn from
        </span>
        <div
          className="landing-seg"
          role="group"
          aria-labelledby={`${id}-alphabet`}
        >
          {tokenAlphabets.map((option, index) => (
            <label key={option.label} className="landing-seg__option">
              <input
                className="landing-sr-only"
                type="radio"
                name={`${id}-alphabet-option`}
                checked={alphabet === index}
                onChange={() => choose({ alphabet: index })}
              />
              <span className="landing-seg__face">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="landing-spec__note">
        {built
          ? `${Math.round(built.entropyBits)} bits, so a collision is even odds at ${collisionAt(
              built.entropyBits,
            ).toLocaleString('en-US')} codes.`
          : 'Refused: said back down a phone, each of these comes out as something else.'}
      </p>
    </div>
  );
}
