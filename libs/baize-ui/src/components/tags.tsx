import type { ReactNode } from 'react';

import type { Availability } from '../tokens/availability.js';
import type { Mechanism } from '../tokens/mechanism.js';
import { classNames, hueClass, stateClass } from './class-names.js';

export interface ChipProps {
  children: ReactNode;
  /**
   * The hue the chip's border and tint are mixed from.
   *
   * The one place a mechanism still carries its colour: a chip on the category
   * index labels the mechanism itself, where there is no game and so no ladder for
   * it to compete with.
   */
  mechanism?: Mechanism;
}

/** The 3px-radius chip: a tint and a hairline mixed from the current colour. */
export function Chip({ children, mechanism }: ChipProps) {
  return (
    <span
      className={classNames('baize-chip', mechanism && hueClass(mechanism))}
    >
      {children}
    </span>
  );
}

export interface TagRowProps {
  children: ReactNode;
}

/** A wrapping row of chips or tags, on the chip gap. */
export function TagRow({ children }: TagRowProps) {
  return <div className="baize-tag-row">{children}</div>;
}

export interface MechanismTagProps {
  /**
   * What the tag says, as the catalogue spells it -- `co-op` rather than
   * `cooperative`.
   */
  label: string;
}

/**
 * A mechanism name, in the secondary text colour.
 *
 * Takes no mechanism token and paints no hue. Mechanism is categorical and the
 * colour ladder is ordinal, the design spends its one saturated colour per card on
 * the ordinal one, and a component that could be handed a hue is a component
 * somebody hands one. A mechanism chip on the category index is where the hue
 * lives, and that is `Chip`.
 */
export function MechanismTag({ label }: MechanismTagProps) {
  return <span className="baize-mechanism-tag">{label}</span>;
}

export interface AvailabilityPillProps {
  /** Selects the state colour. */
  availability: Availability;
  /** The state as the app words it: `in stock`, `reprint pending`. */
  label: string;
}

/**
 * A state pill: a dot in the state colour, then the label.
 *
 * The dot is decoration and is drawn by the stylesheet, so the label is the whole
 * accessible name and a reader who cannot see the colour loses nothing.
 */
export function AvailabilityPill({
  availability,
  label,
}: AvailabilityPillProps) {
  return (
    <span className={classNames('baize-pill', stateClass(availability))}>
      {label}
    </span>
  );
}
