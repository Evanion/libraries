/**
 * A list of rows decided in one call, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/` through
 * `file=libs/react-acl/examples/many.tsx region=many`. React forbids a hook
 * inside a loop, so a row component calling `useCan` for itself is the shape a
 * reader reaches for and the shape that breaks the moment the list is filtered.
 * `useCanMany` decides the whole array in the parent and hands each row its
 * answer as a prop.
 *
 * `src/examples.test.tsx` renders it over a mixed list and asserts the count of
 * editable rows.
 */
// #region many
// @jsx: react-jsx
'use client';

import { useCanMany } from '@evanion/react-acl';

type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

export function ListingTable({ listings }: { listings: Listing[] }) {
  const decisions = useCanMany('listing', 'edit', listings);

  return (
    <ul>
      {listings.map((listing, index) => (
        <li key={listing.id}>
          {listing.id}
          {decisions[index]?.allowed ? (
            <button type="button">Edit</button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
// #endregion many
