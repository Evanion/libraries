import type { SelectHTMLAttributes } from 'react';

import { describedBy, FieldFrame } from './FieldFrame.js';
import { classNames } from './tone.js';

/** A native select's attributes, plus the label, hint and error around it. */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** The select's id; the hint and the error take `<id>-hint` and `<id>-error`. See `Field`. */
  id: string;
  label: string;
  hint?: string;
  /** A server-side error. Its presence marks the select `aria-invalid`. */
  error?: string;
};

/** A labelled native select. Its `<option>`s are its children. */
export function Select({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...select
}: SelectProps) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={classNames('input', className)}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
