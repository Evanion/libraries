/**
 * The same shop policy authored in TypeScript, as compiled source.
 *
 * `apps/docs/content/react-acl/*.mdx` cites the region below through
 * `file=libs/react-acl/examples/typed.tsx region=typed`. It is the counterpart
 * of `mount.tsx`: that file hydrates a document the server sent, this one
 * builds the same document here and keeps the keys and rows the builder knows
 * about.
 *
 * `src/examples.test.tsx` asserts that the matrix this builds equals the one
 * the other five examples run against, so the section teaches one policy in two
 * forms rather than two policies.
 *
 * The `// @jsx:` line is a Twoslash directive; `mount.tsx` explains it.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region typed
// @jsx: react-jsx
'use client';

import { policy } from '@evanion/acl';
import { createPolicyContext } from '@evanion/react-acl';

type Shopper = { id: string; role: 'customer' | 'bookseller' | 'owner' };
type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

export const shop = policy<Shopper>()
  .for<'listing', Listing>('listing', (p) =>
    p
      .allow('read', p.always)
      .allow('edit', p.eq('object.sellerId', 'subject.id'))
      .deny('edit', p.eq('object.status', 'published'))
      .fields(['blurb']),
  )
  .build();

// Shopper and the object map are named once, above. Nothing here repeats them.
export const { PolicyProvider: ShopAccess, useCan } = createPolicyContext(shop);

export function EditControl({ listing }: { listing: Listing }) {
  // 'listing' is a key of the policy. A typo is a compile error here, where the
  // untyped useCan would pass it through and answer unknown-action at runtime.
  const decision = useCan('listing', 'edit', listing);

  if (!decision.allowed) return null;

  return <button type="button">Edit listing</button>;
}
// #endregion typed
