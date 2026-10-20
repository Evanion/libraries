'use client';
import { useState } from 'react';
import AccessDemo, { type AccessState } from '../../landing/AccessDemo';
import { openingGrants } from '../../landing/access';
import { apiAnswer } from './api';
import './authorization.css';

/**
 * The frontpage demonstration with the server half beside it. The panel asks
 * the same policy the interface was drawn from and shows what an API route
 * would answer, so the reader sees the browser hide and the server decide.
 */
export default function AccessApiDemo() {
  const [state, setState] = useState<AccessState>({
    role: 'bookseller',
    status: 'draft',
    grants: openingGrants,
  });
  const answer = apiAnswer(state.role, state.status, state.grants);

  return (
    <div className="authz-hero">
      <AccessDemo onChange={setState} plainLabels />
      <div className="authz-api" role="group" aria-label="Your API">
        <p className="authz-api__title">Your API, same policy</p>
        <p className="authz-api__note">
          The browser only hides the button. The server asks again.
        </p>
        <ul className="authz-api__routes" aria-live="polite">
          {[answer.edit, answer.publish].map((route) => (
            <li
              key={route.line}
              className="authz-api__route"
              data-allowed={route.allowed ? '' : undefined}
            >
              <code>{route.line}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
