'use client';
import { useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { DemoLayout } from '../primitives/DemoLayout';
import { Segmented } from './Segmented';
import {
  actions,
  explain,
  people,
  type ActionId,
  type PersonId,
} from './explain';
import './authorization.css';

const PEOPLE = (Object.keys(people) as PersonId[]).map((id) => ({
  id,
  label: people[id].name,
}));

/** Pick a person and an action on a listing and read the policy's answer in plain words. */
export default function ExplainDemo() {
  const [person, setPerson] = useState<PersonId>('seller');
  const [action, setAction] = useState<ActionId>('edit');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [rowLoaded, setRowLoaded] = useState(true);

  const answer = explain({ person, action, status, rowLoaded });
  const { decision } = answer;
  const tone =
    answer.headline === 'Allowed'
      ? 'yes'
      : answer.headline === 'Refused'
        ? 'no'
        : 'wait';

  const lines = [
    {
      key: 'call',
      content: `access.can(${people[person].name.toLowerCase()}, 'listing', '${action}', listing)`,
    },
    { key: 'open', content: '// {' },
    { key: 'allowed', content: `//   allowed: ${decision.allowed},` },
    { key: 'reason', content: `//   reason: '${decision.reason}',` },
    ...(decision.rule
      ? [
          {
            key: 'rule',
            lit: true,
            tone: decision.allowed ? undefined : ('deny' as const),
            content: `//   rule: '${decision.rule}',${answer.ruleNeedsRow ? ' // needs the row' : ''}`,
          },
        ]
      : []),
    ...(decision.missing
      ? [
          {
            key: 'missing',
            lit: true,
            content: `//   missing: [${decision.missing.map((m) => `'${m}'`).join(', ')}],`,
          },
        ]
      : []),
    { key: 'close', content: '// }' },
  ];

  return (
    <DemoLayout
      controls={
        <div className="authz-demo">
          <Segmented
            label="Who is asking"
            value={person}
            options={PEOPLE}
            onChange={setPerson}
          />
          <Segmented
            label="What they want to do"
            value={action}
            options={actions}
            onChange={setAction}
          />
          <Segmented
            label="The listing is"
            value={status}
            options={[
              { id: 'draft', label: 'Draft' },
              { id: 'published', label: 'Published' },
            ]}
            onChange={setStatus}
          />
          <label className="authz-demo__check">
            <input
              type="checkbox"
              checked={rowLoaded}
              onChange={(e) => setRowLoaded(e.currentTarget.checked)}
            />{' '}
            The listing is loaded (off: only its id is in hand)
          </label>
          <div className="authz-answer" data-tone={tone} aria-live="polite">
            <p className="authz-answer__headline">{answer.headline}</p>
            <p>
              {answer.sentence} {answer.detail}
            </p>
            {answer.fetch.length > 0 && (
              <button
                type="button"
                className="product-button"
                data-primary=""
                onClick={() => setRowLoaded(true)}
              >
                Fetch the listing
              </button>
            )}
          </div>
        </div>
      }
      code={<CodeView label="The decision" lines={lines} />}
    />
  );
}
