import { join } from 'node:path';

import nextra from 'nextra';

// `composePlugins`/`withNx` from @nx/next are deprecated and removed in Nx 24.
// A plain next.config is the recommended pattern now -- Next.js transpiles
// workspace libraries on its own.
const withNextra = nextra({
  defaultShowCopyCode: true,
  latex: true,
  search: {
    codeblocks: false,
  },
});

const workspaceRoot = join(import.meta.dirname, '../..');

export default withNextra({
  // A `file=… region=…` code block is filled from the named region in the
  // package's README, which is itself executed as a test, so the docs app
  // renders the example the package ships rather than a copy of it. A renamed
  // or deleted region fails this build.
  //
  // A loader rather than the remark plugin the demo-apps spec called for:
  // Nextra hands `mdxOptions.remarkPlugins` to unified, which needs plugin
  // functions, and Next 16 rejects a config carrying one. A loader's module
  // path and its `{ root }` option are both strings, and it still runs inside
  // `next build`, so no npm lifecycle hook is needed. Next 16 builds with
  // Turbopack, so the rule goes here rather than in `webpack()`, which is
  // never called.
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
