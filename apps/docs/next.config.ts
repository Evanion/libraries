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

export default withNextra({
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
