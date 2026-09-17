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
 * lowercase letter and digit, which `createToken` refuses.
 *
 * A refusal holds the code already on screen, dimmed, and names the refused
 * characters under it. The code is the last one the package minted and is
 * still true, and a card that empties itself reads as a fault rather than as
 * a guardrail -- which is the opposite of what this control is here to show.
 * Generate is disabled rather than removed, so the shape of the card does not
 * move under the reader.
 *
 * A new code lands left to right, each character turning through that
 * alphabet for a moment before it settles, the separator standing still
 * throughout: 200ms for the first character and 25ms more for each after it.
 * The `<output>` is what a screen reader gets, and holds the code, with the
 * refusal after it, and never a frame of the turning.
 */
export default function TokenSpecimen({ initial }: { initial: string }) {
  const [shape, setShape] = useState(0);
  const [alphabet, setAlphabet] = useState(0);
  const [value, setValue] = useState(initial);
  const id = useId();

  const attempt = useMemo(() => buildToken(shape, alphabet), [shape, alphabet]);
  const built = attempt.kind === 'built' ? attempt.token : undefined;

  // The code a refused dictionary would have replaced stays on screen, dimmed.
  // It is the last one the package did mint, so it is still true, and a card
  // that empties itself reads as a fault rather than as a refusal.
  const shown = useSettled(value, built?.dictionary ?? '', STAGGER_MS) ?? value;
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
        <span
          className={
            built
              ? 'landing-specimen__value'
              : 'landing-specimen__value landing-token__stale'
          }
          aria-hidden="true"
        >
          {body}
          <span className="landing-specimen__mark">{check}</span>
        </span>
        <output className="landing-sr-only" aria-live="polite">
          {attempt.kind === 'built'
            ? value
            : `${value}. Refused: ${attempt.offending.join(', ')}.`}
        </output>
        <span className="landing-specimen__action">
          <Button
            variant="quiet"
            disabled={!built}
            onClick={() => built && setValue(built.generate().value)}
          >
            Generate
          </Button>
        </span>
      </p>

      {attempt.kind === 'refused' ? (
        <p className="landing-token__refused">
          <span>createToken refuses this alphabet:</span>
          {attempt.offending.map((char) => (
            <span key={char} className="landing-token__offending">
              {char}
            </span>
          ))}
        </p>
      ) : null}

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
          : 'Read off a screen or said down a phone, each of these comes back as something else. The code above is the one the last accepted alphabet minted.'}
      </p>
    </div>
  );
}
