import type { ReactNode } from 'react';

export interface CardProps {
  children?: ReactNode;
  /**
   * The picture, above everything else and bled to the card's own edges.
   *
   * A shop leads with the image. A card whose first row is a title and a pill
   * puts a wall of words where the eye expects a thing, and the reason both
   * apps' grids read as a report rather than a shelf is that neither had this
   * slot. Usually a `BoxArtPlaceholder`.
   */
  media?: ReactNode;
  /**
   * What sits on the picture, in its top right corner. An availability pill.
   *
   * On the picture and not in the head row because that row has a title in it,
   * and a pill sharing the line is what makes one card's title wrap where the
   * next card's does not -- which is how a row of cards ends up with nothing
   * lining up. Ignored with no `media`: there is nothing to pin it to.
   */
  pin?: ReactNode;
  /**
   * The top row: a title on the left, a price on the right, baseline-aligned.
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
export function Card({ children, head, foot, media, pin }: CardProps) {
  return (
    <div className="baize-card">
      {media ? (
        <div className="baize-card__media">
          {media}
          {pin ? <div className="baize-card__pin">{pin}</div> : null}
        </div>
      ) : null}
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
