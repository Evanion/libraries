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
  // Fills every `file=… region=…` code block from the named region of the
  // package's own README, so a docs page renders the example the package ships
  // and a renamed region fails this build. The loader carries the rest of the
  // reasoning.
  //
  // The rule goes under `turbopack` rather than in `webpack()`: Next 16 builds
  // with Turbopack, and never calls `webpack()`.
  turbopack: {
    rules: {
      '*.mdx': {
        loaders: [
          {
            loader: '@evanion/doc-examples/mdx-region-loader',
            options: { root: workspaceRoot },
          },
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
