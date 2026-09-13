'use client';

import { Button } from '@evanion/baize-ui';
import { useState } from 'react';
import { useSettled } from './settle';
import { token, tokenParts } from './specimens';

/** Each character lands this much later than the one before it. */
const STAGGER_MS = 25;

/**
 * A code, and a button that mints the next one.
 *
 * Every press is `createToken().generate()` from the published package,
 * drawing from `crypto.getRandomValues` in the reader's browser -- which is
 * why the package moved to Web Crypto. The opening value is the README's
 * specimen, rendered on the server, so the first thing a reader sees is the
 * same on both sides of hydration; the first press replaces it.
 *
 * A new code lands left to right, each character turning through the
 * token's own alphabet for a moment before it settles, the separator
 * standing still throughout: 200ms for the first character and 25ms more
 * for each after it, so the whole code is still by 375ms. The `<output>` is
 * what a screen reader gets and only ever holds the minted code.
 */
export default function TokenSpecimen({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const shown = useSettled(value, token.dictionary, STAGGER_MS) ?? value;
  const { body, check } = tokenParts(shown);

  return (
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
  );
}
