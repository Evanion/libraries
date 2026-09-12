import type { ReactNode } from 'react';

export interface CardProps {
  children?: ReactNode;
  /**
   * The top row: a title on the left, a pill on the right, baseline-aligned.
   * A slot rather than a `title` string, because what goes in it is a `Title`
   * the app may have wrapped in its own link.
   */
  head?: ReactNode;
  /** The bottom row, pinned to the card's foot however tall the body is. */
  foot?: ReactNode;
}

/**
 * The 12px-radius surface on `felt`. One definition of the radius, the border and
 * the elevation.
 */
export function Card({ children, head, foot }: CardProps) {
  return (
    <div className="baize-card">
      {head ? <div className="baize-card__head">{head}</div> : null}
      {children}
      {foot ? <div className="baize-card__foot">{foot}</div> : null}
    </div>
  );
}

export interface PanelProps {
  children?: ReactNode;
  /** The panel's own heading, set at the small label step. */
  heading?: ReactNode;
}

/**
 * A recessed surface: the same radius as a card, a ground mixed back towards
 * `ink`, and no elevation. What a sidebar block and a dashboard tile are.
 */
export function Panel({ children, heading }: PanelProps) {
  return (
    <section className="baize-panel">
      {heading ? <h2 className="baize-panel__heading">{heading}</h2> : null}
      {children}
    </section>
  );
}

export interface SectionHeaderProps {
  /** The heading itself, usually a `Title`. */
  heading: ReactNode;
  /** What sits opposite it on the baseline: a count, a note, a link. */
  aside?: ReactNode;
}

/**
 * A heading with something opposite it, baseline-aligned, with the section's
 * space below.
 *
 * In because all three apps built it and all three built it differently -- a
 * heading row with a trailing count in two of them and a bare heading in the
 * third. It is not page chrome: it carries no nav, no width and no landmark, so
 * each app's shell still owns those.
 */
export function SectionHeader({ heading, aside }: SectionHeaderProps) {
  return (
    <div className="baize-section-header">
      {heading}
      {aside ? (
        <div className="baize-section-header__aside">{aside}</div>
      ) : null}
    </div>
  );
}
