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
 * The alphabet moves the entropy the caption reports, and every option the
 * control offers is one `createToken` accepts. An alphabet the package refuses
 * was offered here once and taken out: a control that breaks the card teaches
 * the reader that the demo is broken, whatever the caption under it says.
 *
 * A new code lands left to right, each character turning through that
 * alphabet for a moment before it settles, the separator standing still
 * throughout: 200ms for the first character and 25ms more for each after it.
 * The `<output>` is what a screen reader gets, and holds the code and never a
 * frame of the turning.
 */
export default function TokenSpecimen({ initial }: { initial: string }) {
  const [shape, setShape] = useState(0);
  const [alphabet, setAlphabet] = useState(0);
  const [value, setValue] = useState(initial);
  const id = useId();

  const token = useMemo(() => buildToken(shape, alphabet), [shape, alphabet]);

  const shown = useSettled(value, token.dictionary, STAGGER_MS) ?? value;
  const { body, check } = tokenParts(shown);

  /**
   * Moves one control and mints a code for where both now stand.
   *
   * The code in hand has the old shape, so it cannot survive the change.
   */
  function choose(next: { shape?: number; alphabet?: number }) {
    const chosen = next.shape ?? shape;
    const drawnFrom = next.alphabet ?? alphabet;

    setShape(chosen);
    setAlphabet(drawnFrom);
    setValue(buildToken(chosen, drawnFrom).generate().value);
  }

  return (
    <div className="landing-spec">
      <p className="landing-specimen landing-specimen--live">
        <span className="landing-specimen__value" aria-hidden="true">
          {body}
          <span className="landing-specimen__mark">{check}</span>
        </span>
        <output className="landing-sr-only" aria-live="polite">
          {value}
        </output>
        <span className="landing-specimen__action">
          <Button
            variant="quiet"
            onClick={() => setValue(token.generate().value)}
          >
            Generate
          </Button>
        </span>
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
        {`${Math.round(token.entropyBits)} bits, so a collision is even odds at ${collisionAt(
          token.entropyBits,
        ).toLocaleString('en-US')} codes.`}
      </p>
    </div>
  );
}
