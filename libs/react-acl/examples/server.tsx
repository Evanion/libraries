/**
 * The same question asked on the trusted side, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/boundary.mdx` through
 * `file=libs/react-acl/examples/server.tsx region=server`. Nothing here imports
 * `@evanion/react-acl`: a server component calls the core, and the page's whole
 * subject is why that is the same question with a different answer to the
 * question of who is bound by it.
 *
 * `src/examples.test.tsx` renders it with an `Access` built in the test, which
 * is what a loader or a server component would pass it.
 */
// #region server
// @jsx: react-jsx
import type { Access, Subject } from '@evanion/acl';

type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

export function ListingPage({
  access,
  shopper,
  listing,
}: {
  access: Access;
  shopper: Subject;
  listing: Listing;
}) {
  const decision = access.can(shopper, 'listing', 'read', listing);

  if (!decision.allowed) return <p>No such listing.</p>;

  return <h1>{listing.id}</h1>;
}
// #endregion server
