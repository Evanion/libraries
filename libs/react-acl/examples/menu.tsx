/**
 * A menu drawn from every action-level decision at once, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/` through
 * `file=libs/react-acl/examples/menu.tsx region=menu`. `useCapabilities` passes
 * no object, so a rule that reads one cannot be decided here; the pages say so
 * and point at `/acl/capabilities` for the contract.
 *
 * `src/examples.test.tsx` renders it and asserts the links are the granted
 * keys.
 */
// #region menu
// @jsx: react-jsx
'use client';

import { useCapabilities } from '@evanion/react-acl';

export function ShopMenu() {
  const capabilities = useCapabilities();

  return (
    <nav aria-label="Shop">
      {Object.entries(capabilities)
        .filter(([, decision]) => decision.allowed)
        .map(([key]) => (
          <a key={key} href={`/${key.replace('.', '/')}`}>
            {key}
          </a>
        ))}
    </nav>
  );
}
// #endregion menu
