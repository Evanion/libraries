import type { ReactNode } from 'react';
import './primitives.css';

/** One line of a document shown as code; `lit` marks the line a control just changed. */
export interface CodeLine {
  key: string;
  content: ReactNode;
  lit?: boolean;
  tone?: 'deny';
}

/** A document shown as code, with the lines that decided something lit. Presentation only. */
export function CodeView({
  lines,
  label,
  className,
}: {
  lines: CodeLine[];
  label: string;
  className?: string;
}) {
  return (
    <figure className="code-view-figure" role="region" aria-label={label}>
      <pre className={['code-view', className].filter(Boolean).join(' ')}>
        <code>
          {lines.map((line) => (
            <span
              key={line.key}
              className="code-view__line"
              data-lit={line.lit ? '' : undefined}
              data-tone={line.tone}
            >
              {line.content}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
