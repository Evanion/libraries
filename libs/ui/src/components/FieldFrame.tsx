import type { ReactNode } from 'react';

import { classNames } from './tone.js';

/** The ids a control names in `aria-describedby`, or undefined for none. */
export const describedBy = (id: string, hint?: string, error?: string) =>
  classNames(hint && `${id}-hint`, error && `${id}-error`) || undefined;

/** The label, hint and error around one field's control. Internal. */
export function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
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
