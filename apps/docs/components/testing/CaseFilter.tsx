'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import './testing.css';

/**
 * Narrows the thirty-six register cases as a reader picks a tier or types.
 *
 * **It hides cases and never renders one.** Pagefind reads the HTML the static
 * export emitted, so an element carrying `hidden` is still indexed and an
 * element that reaches the DOM only after hydration is indexed nowhere. A
 * filter holding the cases as data and rendering the matches would delete
 * thirty-six security cases from search while still looking correct in a
 * browser, on the one page whose purpose is that a sceptic can check it. So
 * every case is server-rendered, this owns none of them, and the only thing it
 * writes to one is `hidden`.
 *
 * **Absent rather than inert without JavaScript.** The strip renders hidden and
 * clears that once it has read the page, so a reader with scripts off gets
 * every case and no control that does nothing.
 *
 * The count above the list always breaks down by tier, in every filtered view.
 * A filtered total with no breakdown is the rounding the register refuses: a
 * selection returning only tier 3 rows has named those classes and defended
 * none of them, and one number cannot say that.
 */

/** The tiers, in the register's own words and the register's own order. */
const TIERS = [
  { tier: '1', label: 'prevented' },
  { tier: '2', label: 'primitive supplied' },
  { tier: '3', label: 'out of scope' },
] as const;

/** One case as the filter reads it off the page. */
interface Entry {
  id: string;
  tier: string;
  identifiers: string;
  search: string;
}

function casesUnder(root: HTMLElement): HTMLElement[] {
  const page = root.closest('main') ?? root.parentElement;
  if (!page) return [];

  return [...page.querySelectorAll<HTMLElement>('.docs-case')];
}

function describe(element: HTMLElement): Entry {
  return {
    id: element.id,
    tier: element.dataset['tier'] ?? '',
    identifiers: (element.dataset['identifiers'] ?? '').toLowerCase(),
    search: element.dataset['search'] ?? '',
  };
}

export default function CaseFilter() {
  const root = useRef<HTMLDivElement>(null);
  const counts = useRef<HTMLParagraphElement>(null);
  // The cases live in a ref and not in state. They are the page's, not this
  // component's: it reads them once and writes nothing but `hidden`.
  const elements = useRef<HTMLElement[]>([]);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [tiers, setTiers] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!root.current) return;
    elements.current = casesUnder(root.current);
    setEntries(elements.current.map(describe));
  }, []);

  const matches = useCallback(
    (entry: Entry) => {
      const words = query.trim().toLowerCase();

      return (
        (tiers.size === 0 || tiers.has(entry.tier)) &&
        (words === '' ||
          entry.search.includes(words) ||
          entry.identifiers.includes(words) ||
          entry.id.includes(words))
      );
    },
    [query, tiers],
  );

  useEffect(() => {
    entries.forEach((entry, at) => {
      const element = elements.current[at];
      if (!element) return;

      const shown = matches(entry);
      element.toggleAttribute('hidden', !shown);

      // Hiding the case a reader is standing on drops focus to the body and
      // loses their place on a page this long, so the count line takes it.
      if (!shown && element.contains(document.activeElement)) {
        counts.current?.focus();
      }
    });
  }, [entries, matches]);

  const shown = (tier: string) =>
    entries.filter((entry) => entry.tier === tier && matches(entry)).length;
  const total = entries.filter(matches).length;

  const toggle = (tier: string) =>
    setTiers((current) => {
      const next = new Set(current);
      if (!next.delete(tier)) next.add(tier);
      return next;
    });

  return (
    <div className="docs-case-filter" hidden={entries.length === 0} ref={root}>
      <div className="docs-case-filter__controls">
        {TIERS.map((one) => (
          <button
            aria-pressed={tiers.has(one.tier)}
            className="baize-button baize-button--variant-quiet"
            key={one.tier}
            onClick={() => toggle(one.tier)}
            type="button"
          >
            {one.label}
          </button>
        ))}
        <label className="docs-case-filter__search">
          <span>Identifier or wording</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="sec-201, CWE-915, prototype"
            type="search"
            value={query}
          />
        </label>
      </div>
      <p
        aria-live="polite"
        className="docs-case-filter__count"
        ref={counts}
        tabIndex={-1}
      >
        {total} cases: {shown('1')} prevented, {shown('2')} primitive supplied,{' '}
        {shown('3')} out of scope.
        {total === 0
          ? ' Name an identifier directly, such as sec-201, or clear the text and pick a tier.'
          : ''}
      </p>
    </div>
  );
}
