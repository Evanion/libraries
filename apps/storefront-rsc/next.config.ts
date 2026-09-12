import type { NextConfig } from 'next';

/**
 * Nothing to configure, and the file still has to exist: `@nx/next/plugin`
 * infers this project's targets from the presence of a `next.config.*`, so
 * deleting it leaves the project with no build, dev or start target.
 *
 * A plain Next config, not wrapped in @nx/next's `composePlugins`/`withNx`:
 * those are deprecated and removed in Nx 24, and Next transpiles workspace
 * libraries without them.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
