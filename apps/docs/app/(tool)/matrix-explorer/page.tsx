import ExplorerScreen from '../../../components/explorer/ExplorerScreen';

export const metadata = {
  title: 'Matrix explorer',
  description:
    'Paste an @evanion/acl matrix document and see what it declares and what it decides. The document is read in your browser and is never uploaded.',
};

/**
 * The matrix explorer, at `/matrix-explorer/`.
 *
 * In `(tool)`, a route group with no layout of its own, so the only thing above
 * it is `app/layout.tsx`: the element, the fonts, the ground and the theme. The
 * docs chrome lives in the sibling `(site)` group, which is what lets this
 * route fill a viewport instead of sitting in a column with a sidebar beside it
 * and a table of contents opposite.
 *
 * At the root rather than under `/acl/`, because a section's URL space is the
 * content tree and a tool is not a page of it. The documentation for the tool
 * is `/acl/explorer/`, which is a page of that tree and links here.
 *
 * Statically generated, like every other route: `next.config.ts` sets
 * `output: 'export'`, there is no server behind the site, and the evaluator is
 * a library that runs in the reader's browser. A document pasted into this
 * screen has nowhere to be uploaded to, and the toolbar says so.
 */
export default function Page() {
  return <ExplorerScreen />;
}
