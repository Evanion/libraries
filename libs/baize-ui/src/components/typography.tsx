import type { ReactNode } from 'react';

import type { ComplexityStop } from '../tokens/complexity.js';
import { classNames, ladderClass, modifier } from './class-names.js';

/** The four steps a title is set at, smallest first. */
export type TitleSize = 'sm' | 'md' | 'lg' | 'xl';

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
  size = 'md',
  complexity,
}: TitleProps) {
  return (
    <Element
      className={classNames(
        'baize-title',
        modifier('baize-title', 'size', size),
        complexity && ladderClass(complexity),
      )}
    >
      {children}
    </Element>
  );
}

/** Which of the three text colours a passage takes. */
export type TextTone = 'chalk' | 'lichen' | 'moss';

export interface TextProps {
  children: ReactNode;
  as?: 'p' | 'span' | 'div' | 'dd' | 'dt';
  tone?: TextTone;
  size?: 'xs' | 'sm' | 'base' | 'md';
  /** Hold the passage to the prose measure. */
  measured?: boolean;
}

/** Text in the reading family. */
export function Text({
  children,
  as: Element = 'p',
  tone = 'lichen',
  size = 'base',
  measured = false,
}: TextProps) {
  return (
    <Element
      className={classNames(
        'baize-text',
        modifier('baize-text', 'tone', tone),
        modifier('baize-text', 'size', size),
        measured && 'baize-text--measured',
      )}
    >
      {children}
    </Element>
  );
}

export interface FigureProps {
  /**
   * The figure, already formatted. A string rather than a number: the en dash in
   * `1–5`, the thousands separator and the currency all depend on a request
   * context this library does not have.
   */
  children: string;
  as?: 'span' | 'dd' | 'p';
  size?: 'base' | 'md' | 'lg' | 'xl';
}

/**
 * A number, set in tabular figures so a column of them aligns.
 *
 * The design makes numeric alignment a requirement rather than a preference,
 * which is why this is a component and not a paragraph: `font-variant-numeric`
 * set in one app and forgotten in another is exactly the drift the library is
 * for. A price, a quantity and a stat figure are all this.
 */
export function Figure({
  children,
  as: Element = 'span',
  size = 'md',
}: FigureProps) {
  return (
    <Element
      className={classNames(
        'baize-figure',
        modifier('baize-figure', 'size', size),
      )}
    >
      {children}
    </Element>
  );
}
