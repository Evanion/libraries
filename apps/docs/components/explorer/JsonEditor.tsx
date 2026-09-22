'use client';

import { useRef, type UIEvent } from 'react';

import { jsonTokenLines } from '../json-tokens';

/**
 * A JSON box a reader types into, with the text highlighted behind it.
 *
 * **A real `<textarea>`, and the colour behind it.** The highlighted layer is
 * an `aria-hidden` `<pre>` and the textarea sits on top of it with transparent
 * text and a visible caret. A `contentEditable` surface or an editor component
 * would own the text instead, and undo, input-method composition, autofill,
 * mobile selection and every screen reader's text-field behaviour come free
 * with the textarea and have to be rebuilt on anything else. This page has
 * readers who tab into it.
 *
 * **Where this technique usually fails is metrics, and here is what holds
 * them.** The two layers are absolutely positioned on the same box and take
 * the same font, size, line height, letter spacing, tab size, padding and
 * border width from one rule each in `explorer.css`, written as a shared
 * selector so a change to one cannot miss the other. Both wrap with
 * `pre-wrap` and `break-word`, which is the second half of it: with wrapping
 * identical there is no horizontal scroll to keep in step, and only
 * `scrollTop` is left. `resize` is off, because a reader dragging the
 * textarea's corner would resize one layer and not the other.
 *
 * The layer is scrolled from the textarea's own `scroll` event and through a
 * ref, so following a caret down a long document costs no render.
 *
 * Lines are joined with `\n` between them and not after the last, so the
 * layer's text is the textarea's text exactly and the two have the same height
 * at every width.
 */
export interface JsonEditorProps {
  id: string;
  /** The accessible name of the box. Not drawn: the pane head names it. */
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** The line to mark, 1-based, where something reported one. */
  errorLine?: number;
  /** The document box grows with the pane; a subject or a row box does not. */
  grow?: boolean;
}

export default function JsonEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  errorLine,
  grow = false,
}: JsonEditorProps) {
  const layer = useRef<HTMLPreElement>(null);
  const lines = jsonTokenLines(value);

  function follow(event: UIEvent<HTMLTextAreaElement>) {
    const held = layer.current;
    if (held) held.scrollTop = event.currentTarget.scrollTop;
  }

  return (
    <div
      className={
        grow ? 'explorer__editor explorer__editor--grow' : 'explorer__editor'
      }
    >
      <pre aria-hidden="true" className="explorer__layer" ref={layer}>
        <code>
          {lines.map((tokens, at) => (
            <span
              className="explorer__line"
              data-error={at + 1 === errorLine ? 'yes' : undefined}
              key={at}
            >
              {tokens.map((token, index) =>
                token.kind === undefined ? (
                  token.text
                ) : (
                  <span className={`json-token--${token.kind}`} key={index}>
                    {token.text}
                  </span>
                ),
              )}
              {at < lines.length - 1 ? '\n' : ''}
            </span>
          ))}
        </code>
      </pre>
      <label className="explorer__sr-only" htmlFor={id}>
        {label}
      </label>
      <textarea
        className="explorer__input"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        onScroll={follow}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
