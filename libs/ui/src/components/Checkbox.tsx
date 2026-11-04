import type { InputHTMLAttributes } from 'react';

/** A native checkbox's attributes, plus the label and hint beside it. */
export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  /** The checkbox's id; the hint takes `<id>-hint`. See `Field`. */
  id: string;
  label: string;
  hint?: string;
};

/**
 * A native checkbox with its label and an optional hint beside it. The hint
 * describes the checkbox, so it stays out of the accessible name.
 */
export function Checkbox({
  id,
  label,
  hint,
  className,
  ...input
}: CheckboxProps) {
  return (
    <div className="check">
      <input
        id={id}
        type="checkbox"
        className={className}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
      />
      <span>
        <label htmlFor={id}>{label}</label>
        {hint ? (
          <span className="hint" id={`${id}-hint`}>
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
