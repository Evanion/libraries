'use client';
import { useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { DemoLayout } from '../primitives/DemoLayout';
import { changes, review, type ChangeId } from './diff';
import './authorization.css';

const KIND: Record<string, string> = {
  granted: 'Gained',
  withdrawn: 'Lost',
  undetermined: 'Needs a look',
  'reads-object': 'Needs the row',
};

/** Pick one rule change and read what `diffMatrix` says about who gains or loses access. */
export default function DiffDemo() {
  const [id, setId] = useState<ChangeId>('sellers-reprice');
  const report = review(id);

  const lines = [
    {
      key: 'call',
      content: 'const diff = diffMatrix(before, after)',
    },
    {
      key: 'version',
      content: `diff.version   // { before: '${report.versions.before}', after: '${report.versions.after}' }`,
    },
    {
      key: 'unchanged',
      lit: report.unchanged,
      content: `diff.unchanged // ${report.unchanged}`,
    },
    ...report.raw.map((f, i) => ({
      key: `finding-${i}`,
      lit: true,
      tone: f.kind === 'withdrawn' ? ('deny' as const) : undefined,
      content: `// { kind: '${f.kind}', key: '${f.key}'${f.cause ? `, cause: '${f.cause}'` : ''} }`,
    })),
  ];

  return (
    <DemoLayout
      controls={
        <div className="authz-demo">
          <fieldset className="authz-changes">
            <legend>Change one rule</legend>
            {changes.map((change) => (
              <label key={change.id} className="authz-changes__option">
                <input
                  type="radio"
                  name="authz-change"
                  checked={id === change.id}
                  onChange={() => setId(change.id)}
                />{' '}
                {change.label}
              </label>
            ))}
          </fieldset>
          <div
            className="authz-answer"
            data-tone={report.unchanged ? 'wait' : 'yes'}
            aria-live="polite"
          >
            <p className="authz-answer__headline">
              {report.unchanged
                ? 'Nothing changes for anyone'
                : 'What this change does'}
            </p>
            {report.unchanged ? (
              <p>The rules are the same rules in a different order.</p>
            ) : (
              <ul className="authz-findings">
                {report.lines.map((line) => (
                  <li key={line.text} data-kind={line.kind}>
                    <span className="authz-findings__kind">
                      {KIND[line.kind]}
                    </span>{' '}
                    {line.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      }
      code={<CodeView label="The diff" lines={lines} />}
    />
  );
}
