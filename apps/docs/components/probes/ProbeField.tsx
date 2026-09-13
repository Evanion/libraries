'use client';

import { useId, useState } from 'react';

import { INPUT_LIMIT, format, type Probe } from './probe';

import './probe.css';

/** What the probe shows: the call, and either its value or what it threw. */
interface Reading {
  input: string;
  /** The last value the call produced, which a throw does not clear. */
  output: string;
  /** The message of whatever the current input threw. */
  error?: string;
}

/**
 * Runs the probe, keeping the last value when the call throws.
 *
 * An input mid-edit throws for most of the characters it passes through --
 * `URN.parse` on half a URN, `Luhn.generate` on an emptied field -- and
 * blanking the value on each of those makes the output flicker rather than
 * read. The message appears beside the value it replaces nothing of, which is
 * what `DataDemo` does with a half-typed brace.
 */
function read(probe: Probe, text: string, last: string): Reading {
  // Truncated here, before the call and before the field shows it, so the
  // argument in the call below the field is the argument the call received.
  const input = text.slice(0, INPUT_LIMIT);

  try {
    return { input, output: format(probe.call(input)) };
  } catch (error) {
    return {
      input,
      output: last,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface ProbeFieldProps {
  probe: Probe;
  /** The argument the README block makes the call with, read at build time. */
  initial: string;
}

/**
 * The chrome around one probe: a label, a field, the call, the value.
 *
 * Rendered on the server as its opening state, so a reader with scripts off,
 * and a search index, get the documented call and the documented value out of
 * the static export. Hydration changes nothing until a key is pressed.
 *
 * `maxLength` stops a paste at the field; {@link read} truncates whatever
 * arrives any other way. The call never runs over more than
 * {@link INPUT_LIMIT} characters, and the field never shows text the call did
 * not receive.
 */
export default function ProbeField({ probe, initial }: ProbeFieldProps) {
  const [reading, setReading] = useState(() => read(probe, initial, ''));
  const id = useId();

  return (
    <div className="probe">
      <div className="probe__row">
        <label className="probe__label" htmlFor={id}>
          {probe.label}
        </label>
        <input
          id={id}
          className="probe__input"
          value={reading.input}
          maxLength={INPUT_LIMIT}
          onChange={(event) =>
            setReading((last) => read(probe, event.target.value, last.output))
          }
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
        />
      </div>

      <pre className="probe__call">
        <code>{probe.source(reading.input)}</code>
      </pre>

      <p className="probe__value">
        <span className="probe__arrow" aria-hidden="true">
          →
        </span>
        <output htmlFor={id}>{reading.output}</output>
      </p>

      {reading.error ? (
        <p className="probe__error" aria-live="polite">
          {reading.error}
        </p>
      ) : null}

      <p className="probe__hint" id={`${id}-hint`}>
        {probe.hint}
      </p>
    </div>
  );
}
