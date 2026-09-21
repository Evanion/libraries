'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import './api.css';

/**
 * Narrows a reference page's entries as a reader types.
 *
 * This answers a different reader from the site's own search. Pagefind serves
 * somebody arriving from outside who knows a name, and it already does: the
 * `/acl/api/` fragment carries one anchor per heading and its results navigate
 * away. This serves somebody already on the page who does not know the name
 * and is scrolling a hundred entries.
 *
 * **It hides entries and never unhides a page that was empty.** Pagefind reads
 * the HTML the static export emitted, so an element carrying `hidden` is still
 * indexed and an element that reaches the DOM only after hydration is indexed
 * nowhere. A filter holding the entry list as data and rendering the matches
 * would delete every entry from the search index while still looking correct
 * in a browser. So every entry is server-rendered, this owns none of them, and
 * the only thing it writes is `hidden`.
 *
 * **Absent rather than inert without JavaScript.** The row renders hidden and
 * clears that on mount, so a reader with no JavaScript gets the whole page and
 * no control that does nothing. The cost is a control that appears a frame
 * late, which is the right trade for a page whose job is to be readable as
 * text.
 */

/** The kind labels, in the order the scale is derived in. */
const ORDER = [
  'error',
  'class',
  'function',
  'constant',
  'interface',
  'type-alias',
] as const;

/** What the chip beside a name says, keyed by the class the loader emitted. */
const LABELS: Record<string, string> = {
  error: 'error',
  class: 'class',
  function: 'function',
  constant: 'constant',
  interface: 'interface',
  'type-alias': 'type',
};

/** One entry as the filter reads it off the page. */
interface Entry {
  name: string;
  kind: string;
}

/** The entries this filter governs, in document order. */
function entriesUnder(root: HTMLElement): HTMLElement[] {
  const page = root.closest('main') ?? root.parentElement;
  if (!page) return [];

  return [...page.querySelectorAll<HTMLElement>('.docs-api-entry')];
}

function describe(element: HTMLElement): Entry {
  const kind = [...element.classList]
    .map((name) => /^baize-kind-(.+)$/.exec(name)?.[1])
    .find(Boolean);

  return {
    name: element.querySelector('h2')?.textContent?.trim() ?? '',
    kind: kind ?? 'constant',
  };
}

export default function ApiFilter() {
  const root = useRef<HTMLDivElement>(null);
  // The elements live in a ref and not in state. They are the page's, not this
  // component's: it reads them once and the only thing it ever writes to one is
  // `hidden`.
  const elements = useRef<HTMLElement[]>([]);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [query, setQuery] = useState('');
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!root.current) return;
    elements.current = entriesUnder(root.current);
    setEntries(elements.current.map(describe));
  }, []);

  const matches = useCallback(
    (entry: Entry) =>
      !off.has(entry.kind) &&
      entry.name.toLowerCase().includes(query.trim().toLowerCase()),
    [off, query],
  );

  useEffect(() => {
    entries.forEach((entry, at) => {
      elements.current[at]?.toggleAttribute('hidden', !matches(entry));
    });
  }, [entries, matches]);

  const kinds = ORDER.filter((kind) =>
    entries.some((entry) => entry.kind === kind),
  );
  const shown = entries.filter(matches).length;
  const filtering = query.trim() !== '' || off.size > 0;
  const on = kinds.filter((kind) => !off.has(kind)).map((kind) => LABELS[kind]);

  const clear = () => {
    setQuery('');
    setOff(new Set());
  };

  const toggle = (kind: string) =>
    setOff((current) => {
      const next = new Set(current);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });

  return (
    <div className="docs-api-filter" ref={root} hidden={entries.length === 0}>
      <div className="docs-api-filter__row">
        <input
          className="docs-api-filter__query"
          type="search"
          value={query}
          placeholder="Filter by name"
          aria-label="Filter the exports by name"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
        />
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`baize-chip docs-api-filter__kind baize-kind-${kind}`}
            aria-pressed={!off.has(kind)}
            onClick={() => toggle(kind)}
          >
            {LABELS[kind]}
          </button>
        ))}
        <span className="docs-api-filter__count">
          {filtering
            ? `${shown} of ${entries.length}`
            : `${entries.length} exports`}
        </span>
      </div>
      {shown === 0 && entries.length > 0 ? (
        <p className="docs-api-filter__empty">
          Nothing matches{' '}
          {query.trim() === '' ? 'the filter' : <code>{query.trim()}</code>}
          {on.length > 0 ? (
            <> in {on.join(', ')}</>
          ) : (
            <> with no kind on</>
          )}.{' '}
          <button
            type="button"
            className="docs-api-filter__clear"
            onClick={clear}
          >
            Clear the filter
          </button>
        </p>
      ) : null}
    </div>
  );
}
