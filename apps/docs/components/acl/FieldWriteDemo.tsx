'use client';

import { useId, useState } from 'react';
import {
  askers,
  decide,
  fieldRows,
  opening,
  pick,
  proposedOf,
  rowOf,
  statuses,
  type Proposal,
  type Status,
} from './field-write';
import './acl-demo.css';

/** One line of JSON, indented, for a pane that shows an object. */
function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * The field axis, worked rather than described: one `canFields` call, its two
 * halves side by side, and what `pickAllowedFields` makes of them.
 *
 * Four controls move the call. Who is signed in decides the action. The
 * proposed write is a body, a status and a `pinned` the policy's name list
 * never mentions. The row's current status is what the `transitions` config
 * reads, so moving it to `locked` walks into the terminal state. The last
 * control takes `status` out of the row handed to `canFields`, which is the
 * half-loaded question the page warns about.
 *
 * Three panes rather than one verdict, because the four hazards are only
 * distinguishable when the action decision and the field map are both on the
 * screen. A refused action with every field still mapped is the one a loop over
 * `fd.fields` walks straight into, and it is visible here as two panes
 * disagreeing.
 *
 * Every value shown came from the package. The component holds the four control
 * values and nothing else; `field-write.ts` builds the policy and makes the
 * calls, and `field-write.test.tsx` holds each pane against the same calls.
 */
/** A labelled select over a fixed set of values. */
function Choice({
  id,
  label,
  value,
  values,
  disabled,
  onPick,
}: {
  id: string;
  label: string;
  value: Status;
  values: readonly Status[];
  disabled?: boolean;
  onPick: (value: Status) => void;
}) {
  return (
    <div className="acl-demo__field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="acl-demo__input"
        value={value}
        disabled={disabled}
        onChange={(event) => onPick(event.target.value as Status)}
      >
        {values.map((each) => (
          <option key={each} value={each}>
            {each}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled checkbox. The label holds markup, so it is a child. */
function Check({
  id,
  checked,
  onToggle,
  children,
}: {
  id: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="acl-demo__check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

export default function FieldWriteDemo() {
  const [proposal, setProposal] = useState<Proposal>(opening);
  const id = useId();

  const decision = decide(proposal);
  const rows = fieldRows(decision);
  const picked = pick(proposal);
  const who = askers.find((asker) => asker.id === proposal.who) ?? askers[0]!;

  function set(patch: Partial<Proposal>) {
    setProposal({ ...proposal, ...patch });
  }

  return (
    <div className="acl-demo">
      <div className="acl-demo__controls">
        <fieldset className="acl-demo__group">
          <legend className="acl-demo__legend">Signed in as</legend>
          <div className="acl-demo__seg">
            {askers.map((asker) => (
              <label key={asker.id} className="acl-demo__seg-option">
                <input
                  className="acl-demo__sr-only"
                  type="radio"
                  name={`${id}-who`}
                  value={asker.id}
                  checked={proposal.who === asker.id}
                  onChange={() => set({ who: asker.id })}
                />
                <span className="acl-demo__seg-face">{asker.name}</span>
              </label>
            ))}
          </div>
          <p className="acl-demo__hint">
            Sam asked this question. Mika is a bookseller. Jo asked a different
            one.
          </p>
        </fieldset>

        <fieldset className="acl-demo__group">
          <legend className="acl-demo__legend">The proposed write</legend>
          <div className="acl-demo__field">
            <label htmlFor={`${id}-body`}>body</label>
            <input
              id={`${id}-body`}
              type="text"
              className="acl-demo__input"
              value={proposal.body}
              onChange={(event) => set({ body: event.target.value })}
            />
          </div>
          <Choice
            id={`${id}-status`}
            label="status"
            value={proposal.status}
            values={statuses}
            onPick={(status) => set({ status })}
          />
          <Check
            id={`${id}-pinned`}
            checked={proposal.pinned}
            onToggle={(pinned) => set({ pinned })}
          >
            post <code>pinned</code>, which no rule names
          </Check>
        </fieldset>

        <fieldset className="acl-demo__group">
          <legend className="acl-demo__legend">The row as it stands</legend>
          <Choice
            id={`${id}-current`}
            label="status now"
            value={proposal.current}
            values={statuses}
            disabled={!proposal.selectedStatus}
            onPick={(current) => set({ current })}
          />
          <Check
            id={`${id}-selected`}
            checked={!proposal.selectedStatus}
            onToggle={(off) => set({ selectedStatus: !off })}
          >
            the query did not select <code>status</code>
          </Check>
          <p className="acl-demo__hint">
            <code>transitions</code> reads the value the row holds now, so a row
            that arrived without it cannot be decided.
          </p>
        </fieldset>
      </div>

      <pre className="acl-demo__call">
        <code>{`access.canFields(
  ${json(who).replace(/\n/g, '\n  ')},
  'question',
  'update',
  ${json(rowOf(proposal)).replace(/\n/g, '\n  ')},
  'write',
  ${json(proposedOf(proposal)).replace(/\n/g, '\n  ')},
)`}</code>
      </pre>

      <div className="acl-demo__panes">
        <section className="acl-demo__pane">
          <h4 className="acl-demo__pane-head">
            <code>fd.action</code>
          </h4>
          <dl className="acl-demo__pairs">
            <dt>key</dt>
            <dd>{decision.action.key}</dd>
            <dt>allowed</dt>
            <dd data-state={decision.action.allowed ? 'allowed' : 'denied'}>
              {String(decision.action.allowed)}
            </dd>
            <dt>reason</dt>
            <dd>{decision.action.reason}</dd>
            <dt>rule</dt>
            <dd>{decision.action.rule ?? 'none'}</dd>
          </dl>
        </section>

        <section className="acl-demo__pane">
          <h4 className="acl-demo__pane-head">
            <code>fd.fields</code>
          </h4>
          <table className="acl-demo__table">
            <thead>
              <tr>
                <th scope="col">field</th>
                <th scope="col">FieldState</th>
                <th scope="col">FieldReason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field}>
                  <th scope="row">
                    <code>{row.field}</code>
                  </th>
                  <td data-state={row.state}>{row.state}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="acl-demo__pane">
          <h4 className="acl-demo__pane-head">
            <code>pickAllowedFields(fd, proposed)</code>
          </h4>
          {picked.kind === 'object' ? (
            <pre className="acl-demo__out">
              <code>{json(picked.value)}</code>
            </pre>
          ) : (
            <pre className="acl-demo__out" data-state="denied">
              <code>
                {picked.name} thrown{'\n'}
                {picked.message}
              </code>
            </pre>
          )}
        </section>
      </div>

      <output className="acl-demo__sr-only" aria-live="polite">
        {`Signed in as ${who.name}. The action is ${
          decision.action.allowed ? 'allowed' : 'refused'
        }, reason ${decision.action.reason}. ${rows
          .map((row) => `${row.field} ${row.state}, ${row.reason}`)
          .join('. ')}. ${
          picked.kind === 'object'
            ? `pickAllowedFields returns ${json(picked.value)}`
            : `pickAllowedFields throws ${picked.name}`
        }.`}
      </output>
    </div>
  );
}
