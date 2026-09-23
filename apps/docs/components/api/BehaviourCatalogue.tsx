'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import './behaviour.css';

/**
 * What a package's tests state about one export: the names in a rail, the case
 * behind the selected name beside it.
 *
 * A flat list answered half the question. A reader could see that
 * `diffMatrix` states 26 sentences and could not see what any of them checks,
 * and 26 lines of prose under a signature pushed the next entry off the screen.
 * So the rail and the pane divide the block: the rail is the catalogue, the
 * pane is one case, and the block is the same height whether the export states
 * 3 sentences or 32.
 *
 * **The pane shows the case and never a reading of it.** No "asserts that the
 * finding names the branch". Distilling a test into a sentence is this page
 * having an opinion about a suite it did not write, and decision A of
 * `docs/specs/2026-09-21-docs-api-reference.md` is that the entry reports what
 * the suite states and infers nothing. The source is the one answer a sceptic
 * can argue with.
 *
 * **The cases arrive from a sidecar, the names from the page.**
 * `apps/docs/tools/behaviour-data.mjs` highlights every case during the build
 * and writes `public/behaviour/<library>.json`; this fetches it once per
 * package, when a reader scrolls a catalogue into view. `@evanion/acl`'s file
 * is 604 kB, against 105 entries on `/acl/api/`, so a page holding every case
 * in its HTML would send that to a reader who came for one signature. The
 * names stay in the markup, because they are what Pagefind indexes and
 * `search: { codeblocks: false }` keeps the cases out of the index regardless.
 *
 * **It is a listbox and not a tab set.** A tab strip puts the labels in a row
 * and needs the labels to be short; these are sentences, and there are 26 of
 * them. The rail is a single-select list, arrow keys move the selection, and
 * `aria-activedescendant` keeps focus on the rail while the pane follows.
 */

/** One sentence a test carries, with the case the sidecar keys by that number. */
export interface BehaviourRow {
  title: string;
  id: number;
}

/** The sentences under one `describe` the suite wrote. */
export interface BehaviourGroup {
  label: string;
  rows: BehaviourRow[];
}

export interface BehaviourCatalogueProps {
  /** The package's own directory, which its sidecar is named after. */
  library: string;
  /** The export this catalogue belongs to, for the rail's accessible name. */
  name: string;
  groups: BehaviourGroup[];
}

/** One case, as `behaviour-data.mjs` wrote it. */
interface Body {
  where: string;
  line: number;
  html: string;
}

interface Sidecar {
  bodies: Record<string, Body>;
  styles: Record<string, string>;
}

/**
 * The fetch for one package, shared by every catalogue on the page.
 *
 * `/acl/api/` mounts 105 of these and they all want the same file. A promise
 * per library means one request however many of them come into view, and a
 * reader who never scrolls past the first entry pays for one package's cases
 * rather than all eleven.
 */
const sidecars = new Map<string, Promise<Sidecar>>();

function load(library: string): Promise<Sidecar> {
  const held = sidecars.get(library);
  if (held) return held;

  const asked = fetch(`/behaviour/${library}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<Sidecar>;
    })
    .then((sidecar) => {
      paint(sidecar.styles);
      return sidecar;
    });

  sidecars.set(library, asked);
  return asked;
}

/**
 * The highlighter's palette, as one stylesheet.
 *
 * Every token in a sidecar carries a class rather than the two themes' colours
 * in its `style`, which is what takes `@evanion/acl`'s cases from 1.36 MB to
 * 604 kB. The ten rules that give those classes their colours ride along in the
 * sidecar and go into the document once. They are the same values Nextra's own
 * fences carry, read out of the same two github themes, so nothing here picks a
 * colour.
 */
let painted = false;

function paint(styles: Record<string, string>): void {
  if (painted || typeof document === 'undefined') return;
  painted = true;

  const sheet = document.createElement('style');
  sheet.dataset.behaviourPalette = '';
  sheet.textContent = Object.entries(styles)
    .map(
      ([token, declarations]) =>
        `.docs-behaviours__body .${token}{${declarations}}`,
    )
    .join('\n');
  document.head.append(sheet);
}

/** Every row the rail holds, in the order the arrow keys walk them. */
function rowsOf(groups: readonly BehaviourGroup[]): BehaviourRow[] {
  return groups.flatMap((group) => group.rows);
}

/**
 * Whether the two panes have room to sit side by side.
 *
 * Read rather than assumed, because the phone layout is not a narrower version
 * of the wide one: the pane moves from the second column to the line under the
 * sentence it belongs to, which is a different tree and not a different rule.
 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 48rem)');
    const read = () => setNarrow(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  return narrow;
}

/** Keeps the selected row inside the rail's own scroll, never the page's. */
function reveal(rail: HTMLElement | null, option: string): void {
  const row = rail?.querySelector<HTMLElement>(`#${CSS.escape(option)}`);
  if (!rail || !row) return;

  const inside = row.getBoundingClientRect();
  const frame = rail.getBoundingClientRect();
  if (inside.top < frame.top) rail.scrollTop += inside.top - frame.top;
  else if (inside.bottom > frame.bottom)
    rail.scrollTop += inside.bottom - frame.bottom;
}

export default function BehaviourCatalogue({
  library,
  name,
  groups,
}: BehaviourCatalogueProps) {
  const prefix = useId();
  const rows = rowsOf(groups);
  const [at, setAt] = useState(0);
  const [sidecar, setSidecar] = useState<Sidecar | null>(null);
  const [unread, setUnread] = useState(false);
  const block = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const narrow = useNarrow();

  const optionId = useCallback(
    (index: number) => `${prefix}-case-${index}`,
    [prefix],
  );

  // Asked for when the reader reaches the block, not when the page mounts. A
  // reference page is a hundred of these and a reader opens one.
  useEffect(() => {
    const element = block.current;
    if (!element) return;

    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watch.disconnect();
        load(library).then(setSidecar, () => setUnread(true));
      },
      { rootMargin: '200px' },
    );

    watch.observe(element);
    return () => watch.disconnect();
  }, [library]);

  useEffect(() => {
    if (!moved.current) return;
    reveal(rail.current, optionId(at));
  }, [at, optionId]);

  const select = (index: number) => {
    moved.current = true;
    setAt(Math.min(Math.max(index, 0), rows.length - 1));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number | undefined> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: rows.length - 1,
      PageDown: at + 8,
      PageUp: at - 8,
    };
    const next = steps[event.key];
    if (next === undefined) return;

    event.preventDefault();
    select(next);
  };

  const row = rows[at];
  const body = sidecar?.bodies[String(row?.id)];

  const pane = (
    <div className="docs-behaviours__pane" data-pagefind-ignore="all">
      <p className="docs-behaviours__title">{row?.title}</p>
      {body ? (
        <>
          <p className="docs-behaviours__where">
            {body.where}:{body.line}
          </p>
          {/* The markup is Shiki's, produced during this build from this
              repository's own test sources. Nothing a reader supplies reaches
              it, and the only tags in it are the highlighter's spans. */}
          <pre className="docs-behaviours__body">
            <code dangerouslySetInnerHTML={{ __html: body.html }} />
          </pre>
        </>
      ) : (
        <p className="docs-behaviours__waiting">
          {unread
            ? `The cases for ${library} did not load. Reload the page to ask again.`
            : 'Reading the case from the package.'}
        </p>
      )}
    </div>
  );

  // Where each group's first row sits in the flat order the arrow keys walk, so
  // a row knows its own index without a counter the render mutates.
  const offsets = groups.map((_, under) =>
    groups.slice(0, under).reduce((sum, each) => sum + each.rows.length, 0),
  );

  return (
    <div className="docs-behaviours" ref={block}>
      <div
        className="docs-behaviours__rail"
        ref={rail}
        role="listbox"
        tabIndex={0}
        aria-label={`What ${name}'s tests state`}
        aria-activedescendant={optionId(at)}
        onKeyDown={onKeyDown}
      >
        {groups.map((group, under) => (
          <div
            className="docs-behaviours__group"
            key={group.label}
            role="group"
            aria-labelledby={`${prefix}-group-${under}`}
          >
            <p
              className="docs-behaviours__label"
              id={`${prefix}-group-${under}`}
              role="presentation"
            >
              {group.label}
            </p>
            {group.rows.map((each, within) => {
              const index = (offsets[under] ?? 0) + within;

              return (
                <Fragment key={each.id}>
                  <div
                    className="docs-behaviours__row"
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === at}
                    onClick={() => select(index)}
                  >
                    {each.title}
                  </div>
                  {narrow && index === at ? (
                    <div role="presentation">{pane}</div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        ))}
      </div>
      {narrow ? null : pane}
    </div>
  );
}
