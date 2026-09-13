'use client';

import { useId, useState } from 'react';
import { demoItems, demoTypes, validateItems, Widgets } from './demo';

type Items = Parameters<typeof Widgets>[0]['items'];

/**
 * What the text in the editor is, once read.
 *
 * Two kinds of wrong, kept apart because they have different fixes. Text that
 * is not JSON has no items in it at all -- a brace deleted a keystroke ago --
 * so `error` says where the parser stopped and the caller keeps the last list
 * that parsed. Text that is JSON but not a list the map can render is what
 * `validateItems` is for: `problems` names the item and the reason, and the
 * list still renders, minus that item, which is what the library does with a
 * bad item in production.
 */
function read(text: string): {
  items?: Items;
  error?: string;
  problems: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return { error: (cause as Error).message, problems: [] };
  }

  const problems = validateItems(parsed).map(
    (problem) =>
      `${problem.index >= 0 ? `item ${problem.index + 1}` : 'the list'}: ${problem.message}`,
  );

  return { items: Array.isArray(parsed) ? (parsed as Items) : [], problems };
}

/**
 * The text as JSON tokens, each in the colour its kind takes.
 *
 * A tokenizer for JSON and nothing else: strings, numbers, the three
 * literals, punctuation. A string followed by a colon is a key. The site's
 * code blocks are highlighted by Shiki at build time; this field is edited,
 * so it is highlighted here, in the design's own colours -- keys in the
 * reading colour, strings in the package hue, the rest stepped back -- rather
 * than Shiki's, whose per-token colours are inlined into each block and are
 * not a stylesheet this can share.
 */
function Highlight({ text }: { text: string }) {
  const tokens = text.split(
    /("(?:[^"\\]|\\.)*"\s*:?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/,
  );

  return tokens.map((token, index) => {
    if (index % 2 === 0) return token;
    const kind = token.startsWith('"')
      ? token.trimEnd().endsWith(':')
        ? 'key'
        : 'string'
      : 'literal';
    return (
      <span key={index} className={`landing-demo__token--${kind}`}>
        {token}
      </span>
    );
  });
}

interface DataDemoProps {
  /** The items as the editor first shows them, serialised on the server. */
  initial: string;
}

/**
 * The items on one side and what the library renders from them on the other.
 *
 * The editor is a highlighted `<pre>` under a transparent `<textarea>` in the
 * same grid cell, sharing one class for every metric that places a glyph --
 * family, size, line height, padding, wrapping, tab size -- so the caret lands
 * on the character it is next to. Both layers wrap the same way, so a long
 * value never scrolls one layer past the other. The `<pre>` sets the height,
 * and carries a trailing newline when the text ends in one, because a
 * textarea shows that empty last line and a `<pre>` collapses it.
 *
 * A textarea rather than a code editor, because what a reader edits here is
 * data: the components are fixed and the data is the whole input. The
 * playground on the React Widget pages loads react-live for snippets that
 * define their own components; here that is a transpiler and a highlighter on
 * the landing page's critical path for twenty lines of JSON.
 *
 * State is the text and the last list that parsed. The preview only changes
 * when a parse succeeds; while the text is mid-edit it holds, and the parser's
 * message sits under the editor.
 */
export default function DataDemo({ initial }: DataDemoProps) {
  const [text, setText] = useState(initial);
  const [rendered, setRendered] = useState<Items>(demoItems);
  const { error, problems } = read(text);
  const editorId = useId();

  function onChange(next: string) {
    setText(next);
    const { items } = read(next);
    if (items) setRendered(items);
  }

  return (
    <div className="landing-demo">
      <div className="landing-demo__editor">
        <label className="landing-demo__label" htmlFor={editorId}>
          items
        </label>
        <div className="landing-demo__field">
          <pre
            className="landing-demo__layer landing-demo__highlight"
            aria-hidden="true"
          >
            <code>
              <Highlight text={text.endsWith('\n') ? `${text}\n` : text} />
            </code>
          </pre>
          <textarea
            id={editorId}
            className="landing-demo__layer landing-demo__source"
            value={text}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-describedby={error ? `${editorId}-error` : undefined}
          />
        </div>
        {error ? (
          <p
            id={`${editorId}-error`}
            className="landing-demo__parse"
            aria-live="polite"
          >
            Not JSON yet: {error}. The preview shows the last version that was.
          </p>
        ) : null}
      </div>
      <div className="landing-demo__preview">
        <p className="landing-demo__label">
          {'<Widgets items={items} />'} with {demoTypes.join(', ')}
        </p>
        <Widgets items={rendered} />
        {problems.length > 0 ? (
          <ul className="landing-demo__problems" aria-live="polite">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
