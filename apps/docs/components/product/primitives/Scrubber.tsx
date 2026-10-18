import { useId } from 'react';
import './primitives.css';

/** A labelled slider over a range, showing its value in words. Presentation only. */
export function Scrubber({
  label,
  min,
  max,
  step,
  value,
  format,
  marks,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  marks?: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="scrubber">
      <label htmlFor={id} className="scrubber__label">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        list={marks ? `${id}-marks` : undefined}
      />
      <output htmlFor={id} className="scrubber__value">
        {format(value)}
      </output>
      {marks && (
        <datalist id={`${id}-marks`}>
          {marks.map((m) => (
            <option key={m.value} value={m.value} label={m.label} />
          ))}
        </datalist>
      )}
    </div>
  );
}
