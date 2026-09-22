'use client';

import { Button, Chip } from '@evanion/baize-ui';
import Link from 'next/link';
import { useId, useMemo, useState, type ChangeEvent } from 'react';

import {
  adopt,
  declared,
  decide,
  readSubject,
  sampleSubject,
  sampleText,
  type PermissionReport,
  type RuleReport,
} from './matrix-explorer';
import './matrix-explorer.css';

/**
 * The reader's own matrix document, read by the package and drawn.
 *
 * A document arrives two ways and no third: pasted into the box, or opened
 * from a file the reader picked. Nothing is read from the URL. A matrix
 * reachable at `?matrix=https://…` is a link somebody else can send, and
 * Swagger UI defaults `queryConfigEnabled` to `false` for that reason.
 *
 * Everything on the screen is either a copy of what the document states or an
 * answer `matrix-explorer.ts` got from `@evanion/acl`. There is no second
 * analysis here: the version, the schema and the rules are the document's own
 * words, `readsObject` is the package's answer, and the decision table is one
 * `capabilities` call.
 *
 * **What a reader with no JavaScript gets.** The instruction, the sample
 * document and a `<noscript>` line saying the controls need JavaScript. Those
 * render at build time, so they are also what Pagefind indexes for this page.
 * A document the reader brings exists only in their browser and is indexed
 * nowhere, which is the same sentence from the search side.
 *
 * **Keyboard.** Every control is a native one in document order: the document
 * box, the two buttons, the file input, then the subject box. Nothing here
 * binds a key, traps focus or overrides the kit's focus ring.
 */
export default function MatrixExplorer() {
  const id = useId();
  const [text, setText] = useState('');
  const [subjectText, setSubjectText] = useState(sampleSubject);
  const [opening, setOpening] = useState<string | undefined>(undefined);

  const adoption = useMemo(() => adopt(text), [text]);
  const report = useMemo(
    () => (adoption.state === 'ready' ? declared(adoption.access) : undefined),
    [adoption],
  );
  const subject = useMemo(() => readSubject(subjectText), [subjectText]);
  const decisions = useMemo(
    () =>
      adoption.state === 'ready' && subject.state === 'ready'
        ? decide(adoption.access, subject.subject)
        : [],
    [adoption, subject],
  );

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
    <div className="matrix-explorer">
      <fieldset className="matrix-explorer__source">
        <legend className="matrix-explorer__legend">The matrix document</legend>
        <label className="matrix-explorer__sr-only" htmlFor={`${id}-document`}>
          The matrix document, as JSON
        </label>
        <textarea
          className="matrix-explorer__box"
          id={`${id}-document`}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a matrix document here."
          rows={10}
          spellCheck={false}
          value={text}
        />
        <div className="matrix-explorer__actions">
          <Button onClick={() => setText(sampleText)} variant="primary">
            Load the sample document
          </Button>
          <Button disabled={text === ''} onClick={() => setText('')}>
            Clear
          </Button>
          <label className="matrix-explorer__file" htmlFor={`${id}-file`}>
            or open a JSON file
            <input
              accept="application/json,.json"
              id={`${id}-file`}
              onChange={open}
              type="file"
            />
          </label>
        </div>
        {opening ? (
          <p className="matrix-explorer__note">
            That file would not open: {opening}
          </p>
        ) : null}
        <noscript>
          <p className="matrix-explorer__note">
            The controls above need JavaScript. The pages this one sits beside
            state the same facts as text.
          </p>
        </noscript>
      </fieldset>

      <output aria-live="polite" className="matrix-explorer__sr-only">
        {adoption.state === 'empty'
          ? 'No document yet.'
          : adoption.state === 'unparsed'
            ? `That text is not JSON yet: ${adoption.message}`
            : adoption.state === 'refused'
              ? `The package refused the document: ${adoption.name}, ${adoption.message}`
              : `The document was adopted. ${report?.permissions.length ?? 0} permissions.`}
      </output>

      {adoption.state === 'empty' ? (
        <section className="matrix-explorer__start">
          <h3 className="matrix-explorer__heading">Start with this one</h3>
          <p className="matrix-explorer__lede">
            A shop matrix over two object kinds. Load it, then change a rule and
            watch the decisions move. Or paste your own over it.
          </p>
          <pre className="matrix-explorer__sample">
            <code>{sampleText}</code>
          </pre>
        </section>
      ) : null}

      {adoption.state === 'unparsed' ? (
        <section className="matrix-explorer__refusal">
          <h3 className="matrix-explorer__heading">
            That text is not JSON yet
          </h3>
          <p className="matrix-explorer__lede">{adoption.message}</p>
          <p className="matrix-explorer__lede">
            A matrix document is JSON. Nothing has reached the package yet, so
            no rule has been read.
          </p>
        </section>
      ) : null}

      {adoption.state === 'refused' ? (
        <section className="matrix-explorer__refusal">
          <h3 className="matrix-explorer__heading">
            <code>{adoption.name}</code>
          </h3>
          <p className="matrix-explorer__lede">{adoption.message}</p>
          <dl className="matrix-explorer__pairs">
            <dt>key</dt>
            <dd>{adoption.at.key ?? 'not named'}</dd>
            <dt>field</dt>
            <dd>{adoption.at.field ?? 'not named'}</dd>
            <dt>where</dt>
            <dd>{adoption.at.where ?? 'not named'}</dd>
          </dl>
          <p className="matrix-explorer__lede">
            {adoption.configFault
              ? 'Change the value those three name, and the document is adopted.'
              : 'That refusal is not an AclConfigError, which no document should produce. Report it.'}{' '}
            <Link href="/acl/errors">What can throw?</Link> carries every class
            with the input that raises it.
          </p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="matrix-explorer__declares">
            <h3 className="matrix-explorer__heading">What it declares</h3>
            <dl className="matrix-explorer__pairs">
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
              <p className="matrix-explorer__lede">
                The document declares no schema, so no condition was checked
                against a field name.
              </p>
            ) : (
              <ul className="matrix-explorer__kinds">
                {report.kinds.map((kind) => (
                  <li key={kind.kind}>
                    <code>{kind.kind}</code>
                    <span>{kind.fields.join(', ') || 'no fields'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="matrix-explorer__permissions">
            <h3 className="matrix-explorer__heading">
              What each permission says
            </h3>
            <ul className="matrix-explorer__list">
              {report.permissions.map((permission) => (
                <Entry key={permission.key} permission={permission} />
              ))}
            </ul>
          </section>

          <fieldset className="matrix-explorer__source">
            <legend className="matrix-explorer__legend">The subject</legend>
            <label className="matrix-explorer__sr-only" htmlFor={`${id}-sub`}>
              The subject, as JSON
            </label>
            <textarea
              className="matrix-explorer__box matrix-explorer__box--short"
              id={`${id}-sub`}
              onChange={(event) => setSubjectText(event.target.value)}
              rows={3}
              spellCheck={false}
              value={subjectText}
            />
            <p className="matrix-explorer__note">
              One <code>capabilities</code> call, no object. A permission whose
              rules need the row answers <code>unevaluable</code> here, which is
              the engine saying fetch and ask again.
            </p>
          </fieldset>

          {subject.state === 'ready' ? (
            <table className="matrix-explorer__table">
              <caption className="matrix-explorer__sr-only">
                Every permission decided against this subject
              </caption>
              <thead>
                <tr>
                  <th scope="col">key</th>
                  <th scope="col">allowed</th>
                  <th scope="col">reason</th>
                  <th scope="col">rule</th>
                  <th scope="col">missing</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.key}>
                    <th scope="row">
                      <code>{decision.key}</code>
                    </th>
                    <td data-state={decision.allowed ? 'allowed' : 'denied'}>
                      {String(decision.allowed)}
                    </td>
                    <td data-state={stateOf(decision.reason)}>
                      {decision.reason}
                    </td>
                    <td>{decision.rule ?? 'none'}</td>
                    <td>{(decision.missing ?? []).join(', ') || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="matrix-explorer__note">
              {subject.state === 'unparsed'
                ? `That subject is not JSON yet: ${subject.message}`
                : 'A subject is a JSON object. An array or a number carries no path to read.'}
            </p>
          )}
        </>
      ) : null}
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
    <li className="matrix-explorer__entry">
      <div className="matrix-explorer__entry-head">
        <code className="matrix-explorer__key">{permission.key}</code>
        <Chip>{permission.published ? 'public' : 'internal'}</Chip>
        {permission.readsObject ? <Chip>needs the row</Chip> : null}
      </div>
      <Rules
        heading="allow"
        empty="No allow rule, so nothing grants this action."
        rules={permission.allow}
      />
      {permission.deny.length > 0 ? (
        <Rules heading="deny" empty="" rules={permission.deny} />
      ) : null}
      {permission.allowList.length > 0 ? (
        <p className="matrix-explorer__rule-line">
          <span className="matrix-explorer__rule-label">fields</span>
          <code>{permission.allowList.join(', ')}</code>
        </p>
      ) : null}
      {permission.configs.map((config) => (
        <p className="matrix-explorer__rule-line" key={config.field}>
          <span className="matrix-explorer__rule-label">{config.form}</span>
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
      <p className="matrix-explorer__rule-line">
        <span className="matrix-explorer__rule-label">{heading}</span>
        <span>{empty}</span>
      </p>
    );
  }

  return (
    <>
      {rules.map((rule, at) => (
        <p className="matrix-explorer__rule-line" key={rule.id ?? at}>
          <span className="matrix-explorer__rule-label">{heading}</span>
          <span className="matrix-explorer__rule-id">
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
