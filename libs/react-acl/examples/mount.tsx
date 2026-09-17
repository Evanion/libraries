/**
 * The boundary component the `react-acl` pages mount, as compiled source.
 *
 * `apps/docs/content/react-acl/*.mdx` cites the region below through
 * `file=libs/react-acl/examples/mount.tsx region=mount`, so what a reader
 * copies off a page is this file, character for character.
 * `src/examples.test.tsx` renders it and asserts that a component under it
 * reads the decision this provider supplies.
 *
 * The `// @jsx:` line is a Twoslash directive. The pages render these regions
 * as Twoslash fences, which compile them against Twoslash's own defaults --
 * classic JSX, which wants `React` in scope -- and the directive is what puts
 * the compiler on the automatic runtime this repo builds with. Twoslash strips
 * the line, so no reader sees it.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region mount
// @jsx: react-jsx
'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { hydratePolicy } from '@evanion/acl';
import type { Matrix } from '@evanion/acl';
import { PolicyProvider } from '@evanion/react-acl';

type Shopper = { id: string; role: 'customer' | 'bookseller' | 'owner' };

export function ShopAccess({
  matrix,
  shopper,
  now,
  children,
}: {
  matrix: Matrix;
  shopper: Shopper;
  now: string;
  children: ReactNode;
}) {
  // hydratePolicy validates, deep-clones and deep-freezes the document, so it
  // runs once per matrix rather than once per render.
  const access = useMemo(() => hydratePolicy(matrix), [matrix]);
  const context = useMemo(() => ({ now }), [now]);

  return (
    <PolicyProvider access={access} subject={shopper} context={context}>
      {children}
    </PolicyProvider>
  );
}
// #endregion mount
