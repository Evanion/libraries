import type { ReactNode } from 'react';

import './listing.css';

/**
 * A code block with a mark saying what was, or was not, done to it.
 *
 * An author does not write this tag. `tools/mdx-listing-loader.mjs` wraps a
 * fence carrying one of documentation standard § 9's five exemption tags in
 * one, so the fence keeps its language and its highlighting and the reader gets
 * the sentence that fence is missing.
 *
 * The mark is a condition of granting the tags, and the superseded standard's
 * § 5 is where that condition was argued: "a reader cannot currently tell
 * `acl/pitfalls`'s nine hand-written fences from `acl/index`'s one executed
 * one", and the tags widen that gap rather than closing it. Rust puts a Ferris icon on a listing that does not compile; this
 * is the same move in type, because this site has no mascot and a line of words
 * survives being read aloud.
 *
 * An untagged fence gets nothing. The mark is the exception's signal, and
 * putting "executed" on every region would spend the reader's attention on the
 * default case.
 */

/** What each tag tells a reader, in the words the page should have used. */
const MARKS: Record<string, { label: string; tone: 'quiet' | 'warning' }> = {
  signature: { label: 'Signature — a shape, not a call', tone: 'quiet' },
  'no-run': { label: 'Not executed — nothing here runs it', tone: 'quiet' },
  'anti-example': { label: 'Do not write this', tone: 'warning' },
  'fails-type-check': {
    label: 'Does not compile, deliberately',
    tone: 'warning',
  },
  elided: { label: 'Excerpt — parts are left out', tone: 'quiet' },
};

interface ListingProps {
  /** One of § 5's five tags, taken off the fence by the loader. */
  mark: string;
  /** The fence itself. */
  children: ReactNode;
}

export default function Listing({ mark, children }: ListingProps) {
  const described = MARKS[mark];

  if (described === undefined) return <>{children}</>;

  return (
    <figure className={`docs-listing docs-listing--${described.tone}`}>
      {children}
      <figcaption className="docs-listing__mark">{described.label}</figcaption>
    </figure>
  );
}
