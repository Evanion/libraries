import { CopyButton } from './CopyButton.js';

/** The code, an optional label, and the copy button's labels. */
export interface CodeBlockProps {
  code: string;
  /** A caption above the code, such as a file name or a language. It also names the block. */
  label?: string;
  /** Renders a copy button when given, with `copiedLabel`. */
  copyLabel?: string;
  copiedLabel?: string;
}

/**
 * Preformatted code in mono. The `<pre>` takes focus, so a keyboard user can
 * scroll a long line.
 */
export function CodeBlock({
  code,
  label,
  copyLabel,
  copiedLabel,
}: CodeBlockProps) {
  const copy =
    copyLabel !== undefined ? (
      <CopyButton
        value={code}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel ?? copyLabel}
      />
    ) : null;

  return (
    <div className="code-block">
      {label !== undefined || copy ? (
        <div className="code-block-head">
          {label !== undefined ? (
            <span className="code-block-label">{label}</span>
          ) : null}
          {copy}
        </div>
      ) : null}
      {/* A scrollable region has to be reachable by keyboard. */}
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
