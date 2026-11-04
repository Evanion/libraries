import { CopyButton } from './CopyButton.js';

const HEAD = 8;
const TAIL = 6;

/** The first and last characters of a long value, so it stays recognisable. */
const shorten = (value: string) =>
  value.length > HEAD + TAIL + 1
    ? `${value.slice(0, HEAD)}…${value.slice(-TAIL)}`
    : value;

/** The value, the copy button's two labels, and whether to shorten it. */
export interface CopyValueProps {
  value: string;
  copyLabel: string;
  copiedLabel: string;
  /**
   * Show the start and end of a long value. The tooltip, the accessible name
   * and the clipboard always carry the whole value.
   */
  truncate?: boolean;
}

/** A value shown in mono with a copy button: an SDK key, an id, a slug. */
export function CopyValue({
  value,
  copyLabel,
  copiedLabel,
  truncate = false,
}: CopyValueProps) {
  return (
    <div className="copy-value">
      <code title={value} aria-label={value}>
        {truncate ? shorten(value) : value}
      </code>
      <CopyButton
        value={value}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />
    </div>
  );
}
