import type { InputHTMLAttributes } from 'react';

import { classNames } from './tone.js';

/** A native input's attributes, plus the label, hint and error around it. */
export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * The input's id. Required: the component holds no state and calls no hook,
   * so it cannot mint one. The hint and the error take `<id>-hint` and
   * `<id>-error`.
   */
  id: string;
  label: string;
  hint?: string;
  /** A server-side error. Its presence marks the input `aria-invalid`. */
  error?: string;
};

/** A labelled native input with an optional hint and error. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: FieldProps) {
  const described =
    classNames(hint && `${id}-hint`, error && `${id}-error`) || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={classNames('input', className)}
        aria-describedby={described}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
