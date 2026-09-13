'use client';

import { Button } from '@evanion/baize-ui';
import { useState } from 'react';
import { token, tokenParts } from './specimens';

/**
 * A code, and a button that mints the next one.
 *
 * Every press is `createToken().generate()` from the published package,
 * drawing from `crypto.getRandomValues` in the reader's browser -- which is
 * why the package moved to Web Crypto. The opening value is the README's
 * specimen, rendered on the server, so the first thing a reader sees is the
 * same on both sides of hydration; the first press replaces it.
 */
export default function TokenSpecimen({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { body, check } = tokenParts(value);

  return (
    <p className="landing-specimen landing-specimen--live">
      <output className="landing-specimen__value" aria-live="polite">
        {body}
        <span className="landing-specimen__mark">{check}</span>
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
