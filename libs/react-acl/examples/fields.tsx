/**
 * A form deciding the action first and then each input, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/` through
 * `file=libs/react-acl/examples/fields.tsx region=fields`.
 *
 * `action.allowed` gates the whole form, and it has to, because `fields` is
 * filled whatever the action decided. A listing that carries neither
 * `sellerId` nor `status` leaves the action `unevaluable` and still reports
 * `blurb: 'allowed'`, so a form reading only the map renders an editable input
 * on a decision that refused. `pickAllowedFields` throws
 * `ActionNotAllowedError` for the same reason.
 *
 * Past the gate the map decides each input, and `!== 'allowed'` is what makes
 * an `unevaluable` field read-only rather than editable.
 *
 * `src/examples.test.tsx` renders it against an allowed listing and against
 * one the action refuses.
 */
// #region fields
// @jsx: react-jsx
'use client';

import { useCanFields } from '@evanion/react-acl';

type Listing = {
  id: string;
  blurb: string;
  price: number;
  sellerId: string;
  status: 'draft' | 'published';
};

export function ListingForm({ listing }: { listing: Listing }) {
  const decision = useCanFields('listing', 'edit', listing, 'write');

  // The field map carries a state for every field whatever the action decided,
  // so a form that reads it without this gate offers a write the engine
  // refused.
  if (!decision.action.allowed) {
    return <p>You cannot edit this listing.</p>;
  }

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
