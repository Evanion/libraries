import type { ReactNode } from 'react';

import { Icon } from './Icon.js';
import type { IconComponent } from './Icon.js';
import type { Tone } from './tone.js';

/** A badge's tone and text. */
export interface BadgeProps {
  /** Without a tone the badge is neutral. */
  tone?: Tone;
  /** Rendered before the text. */
  icon?: IconComponent;
  children: ReactNode;
}

/** A small uppercase chip. Colour comes only from its tone. */
export function Badge({ tone, icon, children }: BadgeProps) {
  return (
    <span className="badge" data-tone={tone}>
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </span>
  );
}
