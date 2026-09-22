'use client';

import { Chip } from '@evanion/baize-ui';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import type { Access } from '@evanion/acl';
import { categoricalClass } from '@evanion/baize-ui/tokens';

import '../json-tokens.css';
import {
  adopt,
  decide,
  declared,
  errorPosition,
  lineAt,
  lineOfKey,
  objectKinds,
  readJsonObject,
  sampleSubject,
  sampleText,
  type Adoption,
  type PermissionReport,
  type Rows,
  type RuleReport,
} from './explorer';
import JsonEditor from './JsonEditor';
import './explorer.css';

/**
 * The matrix explorer, on a screen of its own.
 *
 * Two panes. The left one is what the reader brought, the document above and
 * the subject below it. The right one is what the package answered: the
 * decisions first, because that is what moves when the subject changes, then
 * what the document declares, then what each permission says. Inputs on one
 * side, answers on the other, and neither scrolls the other.
 *
 * A document arrives two ways and no third: pasted into the box, or opened from
 * a file the reader picked. Nothing is read from the URL. A full-screen tool
 * invites a shareable link and that is the thing to refuse: a matrix reachable
 * at `?matrix=…` is a link a third party can send, and Swagger UI defaults
 * `queryConfigEnabled` to `false` for that reason.
 *
 * Everything drawn is either the document's own words or an answer
 * `explorer.ts` got from `@evanion/acl`. There is no second analysis here.
 *
 * **Keyboard.** Document box, subject box, then the splitter, then the
 * toolbar, in that order down the DOM. The splitter is a `separator` that
 * answers Left and Right by two points, Home and End by jumping to a quarter
 * and three quarters. Nothing traps focus and nothing overrides the kit's
 * focus ring. Below 900px the splitter is `display: none`, so it leaves the tab
 * order with the layout it governs.
 *
 * **Without JavaScript** the screen is one line saying so, with the link back
 * to the page that explains the tool as text. A tool whose whole job is to
 * evaluate a document the reader types has no useful inert state, and the
 * documentation page is the thing that reads as text.
 */

/** How much of the width the input pane takes, and the bounds a reader may set. */
const SPLIT = { min: 20, max: 80, initial: 42, step: 2 } as const;

/**
 * How long the box rests before the document is read again, in milliseconds.
 *
 * Long enough that typing a key name is one adoption rather than eight, short
 * enough that a reader who changes a value and looks up has the answer. It is
 * exported because `explorer.test.tsx` waits it out rather than guessing at it.
 */
export const DEBOUNCE = 120;

/** The box's text as the last read saw it, and what that read made of it. */
interface Settled {
  text: string;
  adoption: Adoption;
}

/** The last document that adopted, and the text it adopted from. */
interface Good {
  text: string;
  access: Access;
}

/**
 * The line to mark in the box, where the last read reported one.
 *
 * Two sources, and they locate differently. `JSON.parse` names a character
 * offset in the reader's own text, so the line is exact. The package names a
 * permission key, and the line is found by searching the text for it, because
 * the document reached the package as a parsed object with no offsets left in
 * it.
 */
function lineOf(settled: Settled): number | undefined {
  const { adoption, text } = settled;

  if (adoption.state === 'unparsed') {
    const position = errorPosition(adoption.message);
    return position === undefined ? undefined : lineAt(text, position).line;
  }

  if (adoption.state === 'refused' && adoption.at.key !== undefined) {
    return lineOfKey(text, adoption.at.key);
  }

  return undefined;
}

/** Where a refusal sits, worded, for the line under the message. */
function placeOf(settled: Settled): string | undefined {
  const { adoption, text } = settled;

  if (adoption.state === 'unparsed') {
    const position = errorPosition(adoption.message);
    if (position === undefined) return undefined;
    const { line, column } = lineAt(text, position);
    return `line ${line}, column ${column}`;
  }

  if (adoption.state === 'refused') {
    const line = adoption.at.key && lineOfKey(text, adoption.at.key);
    return line ? `line ${line}` : undefined;
  }

  return undefined;
}

/** A store that never emits, for the one fact that differs between the two renders. */
const unsubscribe = () => {
  // Nothing to release: nothing was ever subscribed to.
};
const subscribeNever = () => unsubscribe;
const onClient = () => true;
const onServer = () => false;

export default function ExplorerScreen() {
  const id = useId();
  const panes = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [subjectText, setSubjectText] = useState(sampleSubject);
  const [opening, setOpening] = useState<string | undefined>(undefined);
  const [split, setSplit] = useState<number>(SPLIT.initial);
  const [dragging, setDragging] = useState(false);
  // One box per object kind, keyed by kind and empty until the reader fills it.
  // Empty is what keeps the screen opening on the answer a permission gives
  // with no row at all.
  const [rowText, setRowText] = useState<Readonly<Record<string, string>>>({});
  // What the box last said, a beat behind what it says now, and the last
  // document that actually adopted. The reports are drawn from the second, so
  // a keystroke that makes the text invalid leaves them standing rather than
  // blanking the screen every time a reader opens a brace.
  const [settled, setSettled] = useState<Settled>({
    text: '',
    adoption: { state: 'empty' },
  });
  const [good, setGood] = useState<Good | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = adopt(text);
      setSettled({ text, adoption: next });
      if (next.state === 'ready') setGood({ text, access: next.access });
      if (next.state === 'empty') setGood(undefined);
    }, DEBOUNCE);

    return () => clearTimeout(timer);
  }, [text]);

  const adoption = settled.adoption;
  const access = adoption.state === 'ready' ? adoption.access : good?.access;
  // True where the reports are showing a document the box no longer holds.
  const stale = adoption.state !== 'ready' && access !== undefined;

  const report = useMemo(
    () => (access === undefined ? undefined : declared(access)),
    [access],
  );
  const kinds = useMemo(
    () => (access === undefined ? [] : objectKinds(access)),
    [access],
  );
  const errorLine = useMemo(() => lineOf(settled), [settled]);
  const subject = useMemo(() => readJsonObject(subjectText), [subjectText]);
  const rows: Rows = useMemo(() => {
    const held: Record<string, Record<string, unknown>> = {};

    for (const kind of kinds) {
      const typed = rowText[kind] ?? '';
      if (typed.trim() === '') continue;

      const read = readJsonObject(typed);
      if (read.state === 'ready') held[kind] = read.value;
    }

    return held;
  }, [kinds, rowText]);
  const decisions = useMemo(
    () =>
      access !== undefined && subject.state === 'ready'
        ? decide(access, subject.value, rows)
        : [],
    [access, subject, rows],
  );

  const at = useCallback((clientX: number) => {
    const box = panes.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const percent = ((clientX - box.left) / box.width) * 100;
    setSplit(Math.min(SPLIT.max, Math.max(SPLIT.min, percent)));
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const move = (event: globalThis.PointerEvent) => at(event.clientX);
    const stop = () => setDragging(false);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [at, dragging]);

  function nudge(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: split - SPLIT.step,
      ArrowRight: split + SPLIT.step,
      Home: 25,
      End: 75,
    };
    const next = moves[event.key];
    if (next === undefined) return;

    event.preventDefault();
    setSplit(Math.min(SPLIT.max, Math.max(SPLIT.min, next)));
  }

  async function open(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setText(await file.text());
      setOpening(undefined);
    } catch (error) {
      setOpening(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className={`explorer docs-identity ${categoricalClass('coral')}`}>
      <noscript>
        <p className="explorer__noscript">
          This tool evaluates a document in your browser, so it needs
          JavaScript.{' '}
          <Link href="/acl/explorer/">Explore a document you have</Link>{' '}
          explains what it does as text.
        </p>
      </noscript>

      <header className="explorer__bar">
        <div className="explorer__identity">
          <h1 className="explorer__name">Matrix explorer</h1>
          <span className="explorer__for">@evanion/acl</span>
        </div>

        <div className="explorer__tools">
          <button
            className="explorer__action explorer__action--lead"
            onClick={() => setText(sampleText)}
            type="button"
          >
            Load the sample
          </button>
          <button
            className="explorer__action"
            disabled={text === ''}
            onClick={() => setText('')}
            type="button"
          >
            Clear
          </button>
          <label className="explorer__file" htmlFor={`${id}-file`}>
            Open a file
            <input
              accept="application/json,.json"
              id={`${id}-file`}
              onChange={open}
              type="file"
            />
          </label>
        </div>

        <div className="explorer__aside">
          <span className="explorer__where">
            Runs in your browser. Nothing is uploaded.
          </span>
          <ThemeButton />
          <Link className="explorer__back" href="/acl/explorer/">
            Documentation
          </Link>
        </div>
      </header>

      {opening ? (
        <p className="explorer__noscript">
          That file would not open: {opening}
        </p>
      ) : null}

      <div
        className="explorer__panes"
        data-dragging={dragging ? 'yes' : undefined}
        ref={panes}
        style={{ ['--explorer-split' as string]: `${split}%` }}
      >
        <section className="explorer__pane explorer__pane--input">
          <div className="explorer__pane-head">
            <h2 className="explorer__pane-title">Document</h2>
            <Status adoption={adoption.state} />
            {placeOf(settled) ? (
              <span className="explorer__hint">{placeOf(settled)}</span>
            ) : null}
          </div>
          <JsonEditor
            errorLine={errorLine}
            grow
            id={`${id}-document`}
            label="The matrix document, as JSON"
            onChange={setText}
            placeholder="Paste a matrix document here, or load the sample."
            value={text}
          />

          <div className="explorer__pane-head">
            <h2 className="explorer__pane-title">Subject</h2>
            <span className="explorer__hint">
              one <code>capabilities</code> call over the whole document
            </span>
          </div>
          <JsonEditor
            id={`${id}-subject`}
            label="The subject, as JSON"
            onChange={setSubjectText}
            value={subjectText}
          />
          {subject.state === 'ready' ? null : (
            <p className="explorer__hint">
              {subject.state === 'unparsed'
                ? `Not JSON yet: ${subject.message}`
                : 'A subject is a JSON object. An array or a number carries no path to read.'}
            </p>
          )}

          {kinds.map((kind) => (
            <ObjectBox
              id={`${id}-row-${kind}`}
              key={kind}
              kind={kind}
              onChange={(next) =>
                setRowText((current) => ({ ...current, [kind]: next }))
              }
              value={rowText[kind] ?? ''}
            />
          ))}

          {kinds.length > 0 ? (
            <p className="explorer__hint">
              An empty box is no row, and every permission that reads the object
              answers <code>unevaluable</code>. A row missing a key the rules
              read answers <code>unevaluable</code> too, naming what is short. A
              key with an empty value is a value, and a comparison against it
              fails.
            </p>
          ) : null}
        </section>

        <div
          aria-label="Width of the document pane"
          aria-orientation="vertical"
          aria-valuemax={SPLIT.max}
          aria-valuemin={SPLIT.min}
          aria-valuenow={Math.round(split)}
          className="explorer__split"
          onKeyDown={nudge}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(true);
            at(event.clientX);
          }}
          role="separator"
          tabIndex={0}
        />

        <section className="explorer__pane explorer__pane--report">
          {adoption.state === 'empty' ? (
            <Start onLoad={() => setText(sampleText)} />
          ) : null}

          {adoption.state === 'unparsed' ? (
            <div className="explorer__block explorer__block--refusal">
              <h2 className="explorer__block-title">
                That text is not JSON yet
              </h2>
              <p className="explorer__prose">{adoption.message}</p>
              <p className="explorer__prose">
                {placeOf(settled)
                  ? `It gave up at ${placeOf(settled)}, which is marked in the box.`
                  : 'It named no position.'}{' '}
                Nothing has reached the package, so no rule has been read.
              </p>
            </div>
          ) : null}

          {adoption.state === 'refused' ? (
            <div className="explorer__block explorer__block--refusal">
              <h2 className="explorer__block-title">
                <code>{adoption.name}</code>
              </h2>
              <p className="explorer__prose">{adoption.message}</p>
              <dl className="explorer__pairs">
                <dt>key</dt>
                <dd>{adoption.at.key ?? 'not named'}</dd>
                <dt>field</dt>
                <dd>{adoption.at.field ?? 'not named'}</dd>
                <dt>where</dt>
                <dd>{adoption.at.where ?? 'not named'}</dd>
                <dt>in the box</dt>
                <dd>{placeOf(settled) ?? 'no line found for that key'}</dd>
              </dl>
              <p className="explorer__prose">
                {adoption.configFault
                  ? 'Change the value those three name, and the document is adopted.'
                  : 'That refusal is not an AclConfigError, which no document should produce. Report it.'}{' '}
                <Link href="/acl/errors/">What can throw?</Link> carries every
                class with the input that raises it.
              </p>
            </div>
          ) : null}

          {stale ? (
            <p className="explorer__standing">
              The three reports below are the document as it last adopted. The
              box has changed since, and what is in it now has not.
            </p>
          ) : null}

          {report ? (
            <>
              <div className="explorer__block">
                <h2 className="explorer__block-title">Decisions</h2>
                {subject.state === 'ready' ? (
                  <table className="explorer__table">
                    <caption className="explorer__sr-only">
                      Every permission decided against this subject
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">key</th>
                        <th scope="col">allowed</th>
                        <th scope="col">reason</th>
                        <th scope="col">rule</th>
                        <th scope="col">missing</th>
                        <th scope="col">asked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map(({ decision, through }) => (
                        <tr key={decision.key}>
                          <th scope="row">
                            <code>{decision.key}</code>
                          </th>
                          <td
                            data-state={decision.allowed ? 'allowed' : 'denied'}
                          >
                            {String(decision.allowed)}
                          </td>
                          <td data-state={stateOf(decision.reason)}>
                            {decision.reason}
                          </td>
                          <td>{decision.rule ?? 'none'}</td>
                          <td>
                            {(decision.missing ?? []).join(', ') || 'none'}
                          </td>
                          <td>{through}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="explorer__prose">
                    {subject.state === 'unparsed'
                      ? `That subject is not JSON yet: ${subject.message}`
                      : 'A subject is a JSON object. An array or a number carries no path to read.'}
                  </p>
                )}
              </div>

              <div className="explorer__block">
                <h2 className="explorer__block-title">What it declares</h2>
                <dl className="explorer__pairs">
                  <dt>version</dt>
                  <dd>{report.version ?? 'none stated'}</dd>
                  <dt>maxStale</dt>
                  <dd>{report.maxStale ?? 'none stated'}</dd>
                  <dt>permissions</dt>
                  <dd>
                    {report.permissions.length}, {report.publishedCount} public
                  </dd>
                  <dt>subject</dt>
                  <dd>
                    {report.subjectFields.length === 0
                      ? 'undeclared, so no subject path is checked'
                      : report.subjectFields.join(', ')}
                  </dd>
                </dl>
                {report.kinds.length === 0 ? (
                  <p className="explorer__prose">
                    The document declares no schema, so no condition was checked
                    against a field name.
                  </p>
                ) : (
                  <ul className="explorer__kinds">
                    {report.kinds.map((kind) => (
                      <li key={kind.kind}>
                        <code>{kind.kind}</code>
                        <span>{kind.fields.join(', ') || 'no fields'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="explorer__block">
                <h2 className="explorer__block-title">
                  What each permission says
                </h2>
                <ul className="explorer__list">
                  {report.permissions.map((permission) => (
                    <Entry key={permission.key} permission={permission} />
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <output aria-live="polite" className="explorer__sr-only">
        {adoption.state === 'empty'
          ? 'No document yet.'
          : adoption.state === 'unparsed'
            ? `That text is not JSON yet: ${adoption.message}`
            : adoption.state === 'refused'
              ? `The package refused the document: ${adoption.name}, ${adoption.message}`
              : `The document was adopted. ${report?.permissions.length ?? 0} permissions.`}
        {stale ? ' The reports below are the document as it last adopted.' : ''}
      </output>
    </div>
  );
}

/**
 * The light and dark toggle, written here rather than taken from the theme.
 *
 * `ThemeSwitch` reads `nextra-theme-docs`'s own config store, which this screen
 * is outside of. The storage key is the site's, so a choice made here is the
 * choice a documentation page opens in.
 *
 * The label is settled after mount. `next-themes` cannot know the resolved
 * theme during a static render, and a server-rendered word that flips on
 * hydration is a mismatch React warns about.
 */
function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  // `useSyncExternalStore` rather than a `setState` in an effect: the store
  // never changes, so the server snapshot is `false`, the client snapshot is
  // `true`, and React swaps them during hydration without a second render
  // pass. The effect form is what the lint rule refuses.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  const dark = resolvedTheme === 'dark';

  return (
    <button
      className="explorer__action"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      type="button"
    >
      {mounted ? (dark ? 'Light' : 'Dark') : 'Theme'}
    </button>
  );
}

/**
 * One object kind's row, entered the way the subject is.
 *
 * **One box per kind, rather than one box and a picker for which kind it is.**
 * The screen's answer is a table with every permission in it, and a picker
 * would leave half of it stale: `listing.update` decided against the row in
 * hand while `order.refund` still carries the answer it gives with none. Two
 * kinds, two boxes, and the whole table is current. A document that reads the
 * object on ten kinds shows ten boxes in a pane that already scrolls, which is
 * the cost.
 */
function ObjectBox({
  id,
  kind,
  value,
  onChange,
}: {
  id: string;
  kind: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const read = value.trim() === '' ? undefined : readJsonObject(value);

  return (
    <>
      <div className="explorer__pane-head">
        <h2 className="explorer__pane-title">Object</h2>
        <code className="explorer__kind">{kind}</code>
        <span className="explorer__hint">
          one <code>can</code> call per permission that reads it
        </span>
      </div>
      <JsonEditor
        id={id}
        label={`The ${kind} row, as JSON`}
        onChange={onChange}
        placeholder={`Leave empty, or enter a ${kind} row.`}
        value={value}
      />
      {read && read.state !== 'ready' ? (
        <p className="explorer__hint">
          {read.state === 'unparsed'
            ? `Not JSON yet: ${read.message}. The row is not used, so the decision is the one with no row.`
            : 'A row is a JSON object. An array or a number carries no path to read.'}
        </p>
      ) : null}
    </>
  );
}

/** What the document pane's head says about the text below it. */
function Status({ adoption }: { adoption: string }) {
  const words: Record<string, string> = {
    empty: 'empty',
    unparsed: 'not JSON',
    refused: 'refused',
    ready: 'adopted',
  };

  return (
    <span className="explorer__status" data-adoption={adoption}>
      {words[adoption]}
    </span>
  );
}

/** The screen before a document: an instruction, and a document to try. */
function Start({ onLoad }: { onLoad: () => void }) {
  return (
    <div className="explorer__block">
      <h2 className="explorer__block-title">Start with this one</h2>
      <p className="explorer__prose">
        A shop matrix over two object kinds. Load it, change a rule, and watch
        the decisions move. Or paste your own into the box on the left.
      </p>
      <button
        className="explorer__action explorer__action--lead"
        onClick={onLoad}
        type="button"
      >
        Load the sample
      </button>
      <pre className="explorer__sample">
        <code>{sampleText}</code>
      </pre>
    </div>
  );
}

/** Which of the three faces a reason takes, on the same scale the demos use. */
function stateOf(reason: string): string {
  if (reason === 'allow') return 'allowed';
  if (reason === 'unevaluable' || reason === 'unusable-clock') {
    return 'unevaluable';
  }
  return 'denied';
}

/** One permission: what it names, then its rules, then its field rules. */
function Entry({ permission }: { permission: PermissionReport }) {
  return (
    <li className="explorer__entry">
      <div className="explorer__entry-head">
        <code className="explorer__key">{permission.key}</code>
        <Chip>{permission.published ? 'public' : 'internal'}</Chip>
        {permission.readsObject ? <Chip>needs the row</Chip> : null}
      </div>
      <Rules
        empty="No allow rule, so nothing grants this action."
        heading="allow"
        rules={permission.allow}
      />
      {permission.deny.length > 0 ? (
        <Rules empty="" heading="deny" rules={permission.deny} />
      ) : null}
      {permission.allowList.length > 0 ? (
        <p className="explorer__rule-line">
          <span className="explorer__rule-label">fields</span>
          <code>{permission.allowList.join(', ')}</code>
        </p>
      ) : null}
      {permission.configs.map((config) => (
        <p className="explorer__rule-line" key={config.field}>
          <span className="explorer__rule-label">{config.form}</span>
          <code>
            {config.field}: {config.detail}
          </code>
        </p>
      ))}
    </li>
  );
}

/** One side of a permission: its allow rules, or its deny rules. */
function Rules({
  heading,
  empty,
  rules,
}: {
  heading: string;
  empty: string;
  rules: readonly RuleReport[];
}) {
  if (rules.length === 0) {
    return empty === '' ? null : (
      <p className="explorer__rule-line">
        <span className="explorer__rule-label">{heading}</span>
        <span>{empty}</span>
      </p>
    );
  }

  return (
    <>
      {rules.map((rule, at) => (
        <p className="explorer__rule-line" key={rule.id ?? at}>
          <span className="explorer__rule-label">{heading}</span>
          <span className="explorer__rule-id">
            {rule.id ?? 'no id, so the engine derives one'}
          </span>
          <code>
            {rule.conditions.length === 0
              ? 'no condition, so it always matches'
              : rule.conditions.join(' and ')}
          </code>
        </p>
      ))}
    </>
  );
}
