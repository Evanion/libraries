import type { ReactNode } from 'react';

import { classNames } from './class-names.js';

export interface CardGridProps {
  children: ReactNode;
  /** Render as a list, where every child is a `CardGridCell`. */
  as?: 'div' | 'ul';
  /** Names the collection for a screen reader. */
  label?: string;
}

/**
 * A grid of cards: as many 17rem columns as fit, on the card gap.
 *
 * In rather than out, against the spec's reading that a grid is app chrome. Two
 * apps built this independently and landed on the same `minmax(17rem, 1fr)` and
 * the same 1rem gap -- which is the evidence the boundary test asks for, and a
 * coincidence that will not survive the next person who changes one of them. It
 * carries no route, no filter and no domain vocabulary: it is the card's own
 * bed.
 *
 * What is still the app's: which cards, in which order, and what sits around the
 * grid.
 */
export function CardGrid({
  children,
  as: Element = 'div',
  label,
}: CardGridProps) {
  return (
    <Element aria-label={label} className="baize-card-grid">
      {children}
    </Element>
  );
}

export interface CardGridCellProps {
  children: ReactNode;
  as?: 'div' | 'li';
  /**
   * Take two columns where the grid is wide enough for them. What a featured
   * entry is, and the one layout decision a cell makes.
   */
  wide?: boolean;
}

/**
 * One cell of the card grid, stretching its child to the cell's full height so a
 * row of cards has one baseline at its foot.
 */
export function CardGridCell({
  children,
  as: Element = 'div',
  wide = false,
}: CardGridCellProps) {
  return (
    <Element
      className={classNames(
        'baize-card-grid__cell',
        wide && 'baize-card-grid__cell--wide',
      )}
    >
      {children}
    </Element>
  );
}
