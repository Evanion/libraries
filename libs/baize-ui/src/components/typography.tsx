import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';

import type { ComplexityStop } from '../tokens/complexity.js';
import { ladderClass } from './class-names.js';
import type { Variant } from './variants.js';

/** The title's classes. The ladder colour reaches it as the `class` argument. */
const title = cva('baize-title', {
  variants: {
    size: {
      sm: 'baize-title--size-sm',
      md: 'baize-title--size-md',
      lg: 'baize-title--size-lg',
      xl: 'baize-title--size-xl',
    },
  },
  defaultVariants: { size: 'md' },
});

/** The four steps a title is set at, smallest first. */
export type TitleSize = Variant<typeof title, 'size'>;

export interface TitleProps {
  children: ReactNode;
  /**
   * The heading level, or `span` where the title is not a heading.
   *
   * The level is document structure and belongs to the page, not to the
   * component: the same game title is an `h1` on its own page and an `h3` in a
   * grid. The union is closed, so a title cannot be made into an arbitrary
   * element.
   */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';
  size?: TitleSize;
  /**
   * The complexity stop whose ramp colour the title takes. Omitted, the title is
   * `chalk`: a heading that names no game sits on no rung.
   */
  complexity?: ComplexityStop;
}

/**
 * A title in the display family, tracked tighter as it gets larger.
 *
 * This is where the complexity ladder binds. The design makes the title the place
 * a reader identifies a game by colour, and the one thing the ladder carries is
 * complexity -- so the binding lives in one component and takes one ordinal value.
 * There is no mechanism prop: a game's title must not be coloured by its category.
 */
export function Title({
  children,
  as: Element = 'h2',
  size,
  complexity,
}: TitleProps) {
  return (
    <Element
      className={title({
        class: complexity && ladderClass(complexity),
        size,
      })}
    >
      {children}
    </Element>
  );
}

/**
 * The passage's classes. `measured` is a boolean variant: the prose measure is one
 * width, and a passage either sits inside it or does not.
 */
const text = cva('baize-text', {
  variants: {
    tone: {
      chalk: 'baize-text--tone-chalk',
      lichen: 'baize-text--tone-lichen',
      moss: 'baize-text--tone-moss',
    },
    size: {
      xs: 'baize-text--size-xs',
      sm: 'baize-text--size-sm',
      base: 'baize-text--size-base',
      md: 'baize-text--size-md',
    },
    measured: {
      true: 'baize-text--measured',
      false: null,
    },
  },
  defaultVariants: { tone: 'lichen', size: 'base', measured: false },
});

/** Which of the three text colours a passage takes. */
export type TextTone = Variant<typeof text, 'tone'>;

export interface TextProps {
  children: ReactNode;
  as?: 'p' | 'span' | 'div' | 'dd' | 'dt';
  tone?: TextTone;
  size?: Variant<typeof text, 'size'>;
  /** Hold the passage to the prose measure. */
  measured?: boolean;
}

/** Text in the reading family. */
export function Text({
  children,
  as: Element = 'p',
  tone,
  size,
  measured,
}: TextProps) {
  return (
    <Element className={text({ measured, size, tone })}>{children}</Element>
  );
}

/** The figure's classes. */
const figure = cva('baize-figure', {
  variants: {
    size: {
      base: 'baize-figure--size-base',
      md: 'baize-figure--size-md',
      lg: 'baize-figure--size-lg',
      xl: 'baize-figure--size-xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface FigureProps {
  /**
   * The figure, already formatted. A string rather than a number: the en dash in
   * `1–5`, the thousands separator and the currency all depend on a request
   * context this library does not have.
   */
  children: string;
  as?: 'span' | 'dd' | 'p';
  size?: Variant<typeof figure, 'size'>;
}

/**
 * A number, set in tabular figures so a column of them aligns.
 *
 * The design makes numeric alignment a requirement rather than a preference,
 * which is why this is a component and not a paragraph: `font-variant-numeric`
 * set in one app and forgotten in another is exactly the drift the library is
 * for. A price, a quantity and a stat figure are all this.
 */
export function Figure({ children, as: Element = 'span', size }: FigureProps) {
  return <Element className={figure({ size })}>{children}</Element>;
}
