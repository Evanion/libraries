import '../probes/probe.css';

export interface FrozenProbeProps {
  /** What the editable argument was, as the field's label. */
  label: string;
  /** The argument the README made the call with. */
  input: string;
  /** The call, as the README wrote it. */
  call: string;
  /** The value the README claimed for it, which CI checked at `sha`. */
  value: string;
  /** The published package name. */
  package: string;
  /** The version the call was run against. */
  version: string;
  /** The commit CI ran the README at. */
  sha: string;
  /** The same page under `/next/`, where the probe runs live. */
  live: string;
}

/**
 * A probe as a release shipped it: the call, the value, and the field that
 * held the argument, disabled.
 *
 * `<Probe>` runs its call against the workspace package on every keystroke.
 * On a page about 3.0.0 that runs `main`, and prints a value 3.0.0 may never
 * have produced under a heading that says it did. So the cut replaces it with
 * this, carrying the pair the README at the pinned commit stated and CI
 * checked, and nothing here executes anything.
 *
 * A literal in every prop: the cut writes them, and this reads no module of the
 * site's own and no package, so the page renders the same whatever `main`
 * becomes.
 */
export default function FrozenProbe({
  label,
  input,
  call,
  value,
  package: name,
  version,
  sha,
  live,
}: FrozenProbeProps) {
  return (
    <div className="probe probe--frozen">
      <div className="probe__row">
        <span className="probe__label">{label}</span>
        <input
          className="probe__input"
          value={input}
          disabled
          readOnly
          aria-label={label}
        />
      </div>

      <pre className="probe__call">
        <code>{call}</code>
      </pre>

      <p className="probe__value">
        <span className="probe__arrow" aria-hidden="true">
          →
        </span>
        <output>{value}</output>
      </p>

      <p className="probe__hint">
        Produced by <code>{name}</code> {version} at <code>{sha}</code>. Not
        re-executed. <a href={live}>Run it live on the unreleased page</a>.
      </p>
    </div>
  );
}
