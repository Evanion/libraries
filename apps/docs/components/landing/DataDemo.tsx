'use client';

import { useId, useState } from 'react';
import { demoItems, demoTypes, validateItems, Widgets } from './demo';

type Items = Parameters<typeof Widgets>[0]['items'];

/**
 * What the text in the editor is, once read: the items, or the reason it is
 * not items yet.
 *
 * Two kinds of wrong. Text that is not JSON has no items in it at all, so the
 * preview keeps the last list that parsed and the message says where the
 * parser stopped. Text that is JSON but not a list the map can render -- an
 * unknown `type`, a missing `id` -- is what `validateItems` is for: the
 * problems are listed, and the preview renders what it can, which is the same
 * thing the library does with a bad item in production.
 */
function read(text: string): {
  items?: Items;
  message?: string;
  problems: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      message: `Not JSON yet: ${(error as Error).message}`,
      problems: [],
    };
  }

  const problems = validateItems(parsed).map(
    (problem) =>
      `${problem.index >= 0 ? `item ${problem.index + 1}` : 'the list'}: ${problem.message}`,
  );

  return {
    items: Array.isArray(parsed) ? (parsed as Items) : [],
    problems,
  };
}

interface DataDemoProps {
  /** The items as the editor first shows them, serialised on the server. */
  initial: string;
}

/**
 * The items on one side and what the library renders from them on the other.
 *
 * A textarea rather than a code editor, because what a reader edits here is
 * data. The playground on the React Widget pages runs code through react-live
 * and Monaco, and a snippet there can define its own components; the point of
 * this demo is the opposite -- the components are fixed, the data is the whole
 * input, and a change to the data is a change on the page. A JSON parser and
 * the package's own validator report what a code evaluator would have reported
 * as a JavaScript error.
 *
 * The client component the landing page has. State is the text and the last
 * list that parsed; everything else is derived on render.
 */
export default function DataDemo({ initial }: DataDemoProps) {
  const [text, setText] = useState(initial);
  const [rendered, setRendered] = useState<Items>(demoItems);
  const { message, problems } = read(text);
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
        <textarea
          id={editorId}
          className="landing-demo__source"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={text.split('\n').length}
        />
      </div>
      <div className="landing-demo__preview">
        <p className="landing-demo__label">
          {'<Widgets items={items} />'} with {demoTypes.join(', ')}
        </p>
        <Widgets items={rendered} />
        {message || problems.length > 0 ? (
          <ul className="landing-demo__problems" aria-live="polite">
            {message ? <li>{message}</li> : null}
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
