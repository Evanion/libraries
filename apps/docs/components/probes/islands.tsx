'use client';

import dynamic from 'next/dynamic';

/** What a package's island needs to pick its probe and open it. */
export interface IslandProps {
  /** The probe's name within its package's module. */
  name: string;
  /** The argument the README block makes the call with. */
  initial: string;
}

/**
 * One lazily-loaded chunk per package.
 *
 * The dispatch is a client component because a server component importing a
 * client one dynamically does not code-split -- `next/dynamic` splits only
 * where the importing module is itself on the client. So this file is what
 * every page loads, and it is a table of names; the package behind a
 * probe arrives only on a page that mounts one.
 *
 * Prerendered, not `ssr: false`: the static export has to carry the documented
 * value before any of this is fetched.
 */
export const islands = {
  luhn: dynamic(() => import('./luhn-probe')),
};

/** The package names a page may write on a `<Probe>`. */
export type ProbePackage = keyof typeof islands;

export default function ProbeIsland({
  probePackage,
  name,
  initial,
}: IslandProps & { probePackage: ProbePackage }) {
  const Island = islands[probePackage];

  return <Island name={name} initial={initial} />;
}
