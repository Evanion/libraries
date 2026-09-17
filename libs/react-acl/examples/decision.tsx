/**
 * One control deciding whether to draw itself, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/` through
 * `file=libs/react-acl/examples/decision.tsx region=decision`. The point the
 * pages make over it is the argument list: three strings and the row, and no
 * `access` or `shopper` prop, because the provider above holds both.
 *
 * `src/examples.test.tsx` renders it under `ShopAccess` for a seller who owns
 * the listing and for one who does not.
 */
// #region decision
// @jsx: react-jsx
'use client';

import { useCan } from '@evanion/react-acl';

type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

export function EditControl({ listing }: { listing: Listing }) {
  const decision = useCan('listing', 'edit', listing);

  if (!decision.allowed) return null;

  return <button type="button">Edit listing</button>;
}
// #endregion decision
