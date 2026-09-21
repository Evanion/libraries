import { join } from 'node:path';

import nextra from 'nextra';

// A plain Next config, not wrapped in @nx/next's `composePlugins`/`withNx`:
// those are deprecated and removed in Nx 24, and Next transpiles workspace
// libraries without them.
const withNextra = nextra({
  defaultShowCopyCode: true,
  latex: true,
  search: {
    codeblocks: false,
  },
});

const workspaceRoot = join(import.meta.dirname, '../..');

export default withNextra({
  // The first expands every `<!-- reference … -->` directive on an API
  // reference page into the entry the package's own declarations describe: a
  // summary, a collapsed docblock, a signature fence and an example fence. It
  // fills its own example rather than leaving a `file=… region=…` fence behind
  // it, because Turbopack runs these in the reverse of the order they are
  // listed and a fence written for a loader that has already run reaches the
  // page empty. The loader carries the rest of the reasoning.
  //
  // The second fills every `file=… region=…` code block from the named region
  // of the package's own README, so a docs page renders the example the package
  // ships and a renamed region fails this build.
  //
  // The third rewrites a ```mermaid fence into the site's own `<Diagram>`,
  // which has to happen before Nextra's own Mermaid plugin claims the fence.
  // That loader carries why.
  //
  // The fourth wraps a fence carrying one of the documentation standard's
  // exemption tags in `<Listing>`, so a block nothing executed says so. It runs
  // last because it reads fences and writes around them, and the three before
  // it are what decide which fences exist.
  //
  // The rule goes under `turbopack` rather than in `webpack()`: Next 16 builds
  // with Turbopack, and never calls `webpack()`.
  turbopack: {
    rules: {
      '*.mdx': {
        loaders: [
          {
            loader: '@evanion/doc-examples/mdx-reference-loader',
            options: { root: workspaceRoot },
          },
          {
            loader: '@evanion/doc-examples/mdx-region-loader',
            options: { root: workspaceRoot },
          },
          join(import.meta.dirname, 'tools/mdx-diagram-loader.mjs'),
          join(import.meta.dirname, 'tools/mdx-listing-loader.mjs'),
        ],
      },
    },
  },

  // The site is published to GitHub Pages, which serves static files only.
  // Every page here is already prerendered via generateStaticParams, so there
  // is nothing dynamic to lose.
  output: 'export',

  // Next's image optimiser needs a server. There is none.
  images: { unoptimized: true },

  // Emits `about/index.html` rather than `about.html`, which is what GitHub
  // Pages resolves reliably for a bare `/about` request.
  trailingSlash: true,
});
