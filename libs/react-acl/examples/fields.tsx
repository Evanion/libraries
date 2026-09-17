/**
 * A form deciding each input separately, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/` through
 * `file=libs/react-acl/examples/fields.tsx region=fields`. The form reads
 * `fields`, which is a map over every field name; `!== 'allowed'` is what makes
 * an `unevaluable` field read-only rather than editable.
 *
 * `src/examples.test.tsx` renders it and asserts which inputs came back
 * read-only.
 */
// #region fields
// @jsx: react-jsx
'use client';

import { useCanFields } from '@evanion/react-acl';

type Listing = { id: string; blurb: string; price: number };

export function ListingForm({ listing }: { listing: Listing }) {
  const decision = useCanFields('listing', 'edit', listing, 'write');

  return (
    <form>
      <label>
        Blurb
        <input
          name="blurb"
          defaultValue={listing.blurb}
          readOnly={decision.fields['blurb'] !== 'allowed'}
        />
      </label>
      <label>
        Price
        <input
          name="price"
          defaultValue={listing.price}
          readOnly={decision.fields['price'] !== 'allowed'}
        />
      </label>
    </form>
  );
}
// #endregion fields
