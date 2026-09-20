'use client';

import { Button } from '@evanion/baize-ui';
import { useId, useState } from 'react';
import {
  ask,
  questionOf,
  refetch,
  seed,
  selectable,
  subject,
  type Query,
} from './unevaluable';
import './acl-demo.css';

/** What each reason means, in the one sentence the pane has room for. */
const meaning: Record<string, string> = {
  allow: 'An allow rule matched and no deny did.',
  'no-rule-matched': 'Nothing granted the action. That is a real no.',
  denied: 'A deny rule matched, and a deny outranks every allow beside it.',
  unevaluable:
    'The engine could not read a path a rule names. Fetch what missing names and ask again.',
};

/**
 * The fourth answer, and the refetch that repairs it.
 *
 * A checkbox per field says whether the query selected it. A field left out
 * never reaches `access.can`, so the rule that reads it has nothing to compare
 * and the decision comes back `unevaluable` with `missing` naming the path.
 * Refetch selects exactly what `missing` names and asks again, which is the
 * loop the page teaches in prose.
 *
 * The value selects are there so the other three answers are reachable from the
 * same control: the question is yours or Jo's, and open or locked. A reader who
 * has just watched `unevaluable` turn into `allow` by fetching a field has the
 * distinction the page needs them to keep, which is that `unevaluable` is a
 * question about the data rather than a refusal.
 *
 * `unevaluable.ts` builds the policy and makes the call; nothing here decides
 * anything. `unevaluable.test.tsx` holds each state against the same call.
 */
export default function UnevaluableDemo() {
  const [query, setQuery] = useState<Query>(seed);
  const id = useId();

  const question = questionOf(query);
  const decision = ask(query);
  const missing = decision.missing ?? [];

  function toggle(field: 'askedBy' | 'status', on: boolean) {
    setQuery({
      ...query,
      selected: on
        ? [...query.selected, field]
        : query.selected.filter((held) => held !== field),
    });
  }

  return (
    <div className="acl-demo">
      <div className="acl-demo__controls">
        <fieldset className="acl-demo__group">
          <legend className="acl-demo__legend">What the query selected</legend>
          {selectable.map((entry) => (
            <div key={entry.field} className="acl-demo__row">
              <div className="acl-demo__check">
                <input
                  id={`${id}-${entry.field}`}
                  type="checkbox"
                  checked={query.selected.includes(entry.field)}
                  onChange={(event) =>
                    toggle(entry.field, event.target.checked)
                  }
                />
                <label htmlFor={`${id}-${entry.field}`}>
                  <code>{entry.label}</code>
                </label>
              </div>
              <div className="acl-demo__field">
                <label
                  htmlFor={`${id}-${entry.field}-value`}
                  className="acl-demo__sr-only"
                >
                  the value {entry.label} holds
                </label>
                <select
                  id={`${id}-${entry.field}-value`}
                  className="acl-demo__input"
                  value={query[entry.field]}
                  disabled={!query.selected.includes(entry.field)}
                  onChange={(event) =>
                    setQuery({ ...query, [entry.field]: event.target.value })
                  }
                >
                  {entry.values.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <p className="acl-demo__hint">
            The allow rule reads <code>object.askedBy</code> and the deny rule
            reads <code>object.status</code>. A field the query left out never
            reaches the engine.
          </p>
        </fieldset>

        <fieldset className="acl-demo__group">
          <legend className="acl-demo__legend">The question in hand</legend>
          <pre className="acl-demo__out">
            <code>{JSON.stringify(question, null, 2)}</code>
          </pre>
          <Button
            variant="standard"
            disabled={missing.length === 0}
            onClick={() => setQuery(refetch(query))}
          >
            Refetch what missing names
          </Button>
          <p className="acl-demo__hint">
            {missing.length === 0
              ? 'The decision named nothing to fetch, so there is nothing to repair.'
              : `Selects ${missing.join(' and ')} and asks again.`}
          </p>
        </fieldset>
      </div>

      <pre className="acl-demo__call">
        <code>{`access.can(${JSON.stringify(subject)}, 'question', 'update', ${JSON.stringify(
          question,
        )})`}</code>
      </pre>

      <div className="acl-demo__panes">
        <section className="acl-demo__pane">
          <h4 className="acl-demo__pane-head">
            <code>decision</code>
          </h4>
          <dl className="acl-demo__pairs">
            <dt>allowed</dt>
            <dd data-state={decision.allowed ? 'allowed' : 'denied'}>
              {String(decision.allowed)}
            </dd>
            <dt>reason</dt>
            <dd
              data-state={
                decision.reason === 'allow'
                  ? 'allowed'
                  : decision.reason === 'unevaluable'
                    ? 'unevaluable'
                    : 'denied'
              }
            >
              {decision.reason}
            </dd>
            <dt>rule</dt>
            <dd>{decision.rule ?? 'none'}</dd>
            <dt>missing</dt>
            <dd>{missing.length === 0 ? 'none' : missing.join(', ')}</dd>
          </dl>
        </section>

        <section className="acl-demo__pane">
          <h4 className="acl-demo__pane-head">What that answer is</h4>
          <p className="acl-demo__meaning">{meaning[decision.reason]}</p>
        </section>
      </div>

      <output className="acl-demo__sr-only" aria-live="polite">
        {`allowed ${decision.allowed}, reason ${decision.reason}${
          missing.length === 0 ? '' : `, missing ${missing.join(' and ')}`
        }. ${meaning[decision.reason]}`}
      </output>
    </div>
  );
}
