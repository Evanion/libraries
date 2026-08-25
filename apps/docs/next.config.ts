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

export default withNextra({});
