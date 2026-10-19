'use client';
import { useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { DemoLayout } from '../primitives/DemoLayout';
import { FAULTS, listing, problemsFor, summary, type Fault } from './validate';

/** A CMS payload the reader breaks three ways; the problem list is the real `validateItems`. */
export default function ValidateDemo() {
  const [faults, setFaults] = useState<Fault[]>([]);
  const problems = problemsFor(faults);

  function toggle(id: Fault) {
    setFaults(
      faults.includes(id) ? faults.filter((f) => f !== id) : [...faults, id],
    );
  }

  return (
    <DemoLayout
      controls={
        <div className="validate-demo">
          <fieldset className="validate-demo__faults">
            <legend>Change the saved page</legend>
            {FAULTS.map((fault) => (
              <label key={fault.id}>
                <input
                  type="checkbox"
                  checked={faults.includes(fault.id)}
                  onChange={() => toggle(fault.id)}
                />
                {fault.label}
              </label>
            ))}
          </fieldset>
          <div
            className="validate-demo__problems"
            role="region"
            aria-label="Problems"
          >
            <p aria-live="polite">{summary(problems)}</p>
            <ul>
              {problems.map((problem) => (
                <li key={`${problem.id}-${problem.message}`}>
                  <code>{problem.id}</code> ({problem.type}): {problem.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      code={
        <CodeView
          label="The saved page"
          lines={listing(faults).map((line) => ({
            key: line.key,
            lit: line.lit,
            content: line.text,
          }))}
        />
      }
    />
  );
}
