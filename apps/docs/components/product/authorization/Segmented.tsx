import { useId } from 'react';

/** One of a few choices, drawn as the landing page's segment and announced as a radio group. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const group = useId();
  return (
    <div className="authz-field">
      <span className="authz-field__label">{label}</span>
      <div className="landing-seg" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <label key={option.id} className="landing-seg__option">
            <input
              className="baize-visually-hidden"
              type="radio"
              name={group}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="landing-seg__face">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
