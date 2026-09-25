/**
 * The same question asked on the trusted side, as compiled source.
 *
 * Cited by `apps/docs/content/react-acl/boundary.mdx` through
 * `file=libs/react-acl/examples/server.tsx region=server`. Nothing here imports
 * `@evanion/react-acl`: the server builds its evaluator once at module scope,
 * and the page that renders a listing and the handler that edits one each ask
 * it for themselves.
 *
 * The rules are the ones `typed.tsx` authors, less the field rule, which the
 * boundary page never asks about. `src/examples.test.tsx` renders `ListingPage`
 * and calls `editListing` for a listing the shopper owns, one somebody else
 * owns, and one already published.
 *
 * The `// @jsx:` line is a Twoslash directive; `mount.tsx` explains it.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region server
// @jsx: react-jsx
import { policy } from '@evanion/acl';

type Shopper = { id: string; role: 'customer' | 'bookseller' | 'owner' };
type Listing = { id: string; sellerId: string; status: 'draft' | 'published' };

// Built once per server process.
export const access = policy<
  Shopper,
  { listing: Listing },
  { listing: 'read' | 'edit' }
>()
  .for('listing', (p) =>
    p
      .allow('read', p.always)
      .allow('edit', p.eq('object.sellerId', 'subject.id'))
      .deny('edit', p.eq('object.status', 'published')),
  )
  .build();

// A server component. The loader of a React Router route asks the same way.
export function ListingPage({
  shopper,
  listing,
}: {
  shopper: Shopper;
  listing: Listing;
}) {
  const decision = access.can(shopper, 'listing', 'read', listing);

  if (!decision.allowed) return <p>No such listing.</p>;

  return <h1>{listing.id}</h1>;
}

// The handler behind the Edit button. The caller passes the shopper its
// session resolved and the listing it read from the database, never either one
// from the posted form.
export function editListing(
  shopper: Shopper,
  listing: Listing,
  blurb: string,
): Response {
  const decision = access.can(shopper, 'listing', 'edit', listing);

  if (!decision.allowed) return new Response(null, { status: 403 });

  return Response.json({ ...listing, blurb });
}
// #endregion server
