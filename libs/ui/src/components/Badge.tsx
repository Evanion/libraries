import type { ReactNode } from 'react';

import type { Tone } from './tone.js';

/** A badge's tone and text. */
export interface BadgeProps {
  /** Without a tone the badge is neutral. */
  tone?: Tone;
  children: ReactNode;
}

/** A small uppercase chip. Colour comes only from its tone. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}
