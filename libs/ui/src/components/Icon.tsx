import type { ComponentType, SVGProps } from 'react';

import { classNames } from './tone.js';

/**
 * Any SVG component that takes `size` and `strokeWidth`, which is the shape
 * Lucide's icons have. The package depends on no icon set.
 */
export type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
>;

/** `sm` is 14px, `md` 16px and `lg` 20px. */
export type IconSize = 'sm' | 'md' | 'lg';

const PIXELS: Record<IconSize, number> = { sm: 14, md: 16, lg: 20 };

/** An icon, its size and an optional accessible name. */
export interface IconProps {
  icon: IconComponent;
  /** Defaults to `md`. */
  size?: IconSize;
  /**
   * Without a label the icon is decorative and hidden from assistive tech.
   * With one it is an image with that name.
   */
  label?: string;
  className?: string;
}

/** Renders an icon component at a fixed size. The stylesheet sets the stroke. */
export function Icon({
  icon: Glyph,
  size = 'md',
  label,
  className,
}: IconProps) {
  return (
    <Glyph
      size={PIXELS[size]}
      className={classNames('icon', className)}
      data-size={size}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label })}
    />
  );
}
