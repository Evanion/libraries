import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';

import type { ComplexityStop } from '../tokens/complexity.js';
import type { Variant } from './variants.js';

export interface StatProps {
  /**
   * The cell's value, already worded: `1–5`, `40–70 min`, `Midweight`. A string
   * and never a number, because the dash, the unit, the separator and the tier's
   * vocabulary are all decisions the app's request context owns.
   */
  figure: string;
  /**
   * What the value is, and the place a number behind a word goes:
   * `players`, `playtime`, `complexity 2.4 / 5`.
   */
  label: string;
  /** Anything that belongs under the label, such as a `ComplexityRamp`. */
  children?: ReactNode;
}

/**
 * One cell of the stat line: the figure above its label, figure first in the
 * document so a screen reader reaches the value before the word.
 */
export function Stat({ figure, label, children }: StatProps) {
  return (
    <div className="baize-stat">
      <span className="baize-stat__figure baize-figure">{figure}</span>
      <span className="baize-stat__label">{label}</span>
      {children}
    </div>
  );
}

/**
 * The stat line's classes. `base` is emitted and styles nothing: `.baize-statline`
 * is already that size, and `lg` is the only step with a rule of its own.
 */
const statLine = cva('baize-statline', {
  variants: {
    size: {
      base: 'baize-statline--size-base',
      lg: 'baize-statline--size-lg',
    },
  },
  defaultVariants: { size: 'base' },
});

export interface StatLineProps {
  children: ReactNode;
  /** `lg` is the size the line takes when it leads a page rather than a card. */
  size?: Variant<typeof statLine, 'size'>;
  /** Names the group for a screen reader, e.g. `Wingspan at a glance`. */
  label?: string;
}

/**
 * Players, time and complexity in a rule-bounded row.
 *
 * The design's hero and structural device: it leads rather than sitting beneath a
 * photograph, because those three figures are how anyone identifies a game at a
 * glance. Columns are sized to their content rather than split into equal thirds,
 * which is what stops a playtime range from wrapping at narrow widths.
 */
export function StatLine({ children, size, label }: StatLineProps) {
  return (
    <div
      aria-label={label}
      className={statLine({ size })}
      role={label ? 'group' : undefined}
    >
      {children}
    </div>
  );
}

/**
 * The ramp colour each filled pip takes, one class per stop.
 *
 * Spelled out against `ComplexityStop` rather than derived from the stop number:
 * a sixth stop added to the token module fails to compile here until the
 * stylesheet has a rule for it.
 */
const pipStops = {
  1: 'baize-complexity__pip--stop-1',
  2: 'baize-complexity__pip--stop-2',
  3: 'baize-complexity__pip--stop-3',
  4: 'baize-complexity__pip--stop-4',
  5: 'baize-complexity__pip--stop-5',
} satisfies Record<ComplexityStop, string>;

/** One pip. Unfilled where it sits above the stop, which is `stop: undefined`. */
const pip = cva('baize-complexity__pip', { variants: { stop: pipStops } });

export interface ComplexityRampProps {
  /** How many pips are filled, and therefore which ramp stops they take. */
  stop: ComplexityStop;
  /**
   * The accessible name, already worded and already formatted: `complexity 2.4 of 5`.
   * The ramp is a graphic, so this is the only thing a screen reader gets from
   * it.
   */
  label: string;
}

/**
 * Five pips, filled up to the stop, each filled pip in its own ramp colour.
 *
 * Per-pip colour rather than one colour for the filled run: the ramp is
 * sequential, and a bar that lightens left to right reads as a scale where a
 * uniform bar reads as a count.
 *
 * The same five colours the title above it is set in, so the ladder on a card is
 * one statement made twice rather than two channels to reconcile.
 */
export function ComplexityRamp({ stop, label }: ComplexityRampProps) {
  return (
    <span aria-label={label} className="baize-complexity" role="img">
      {([1, 2, 3, 4, 5] as const).map((index) => (
        <span
          className={pip({ stop: index <= stop ? index : undefined })}
          key={index}
        />
      ))}
    </span>
  );
}
