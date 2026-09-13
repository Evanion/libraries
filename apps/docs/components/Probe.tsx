import { seedOf } from './probes/claims';
import ProbeIsland, { type ProbePackage } from './probes/islands';
import { probes as luhn } from './probes/luhn';
import type { Probe as ProbeDefinition } from './probes/probe';
import { probes as token } from './probes/token';

/**
 * Every probe the site ships, by package.
 *
 * Read here on the server to seed the field. The same modules are imported by
 * the islands on the client, so the call a reader types into is the call this
 * file read the argument out of.
 */
const catalogue: Record<ProbePackage, Record<string, ProbeDefinition>> = {
  luhn,
  token,
};

interface ProbeProps {
  /** The package the probe belongs to, which is also its chunk. */
  package: ProbePackage;
  /** The probe's name within that package's module. */
  probe: string;
}

/**
 * The tested example, made typeable.
 *
 * Usable as a JSX tag in any MDX page through the map in mdx-components.js,
 * under the `file=… region=…` block it belongs to:
 *
 * ```mdx
 * ```ts file=libs/luhn/README.md region=generate
 * ```
 *
 * <Probe package="luhn" probe="generate" />
 * ```
 *
 * A server component: the opening argument is read out of that same region at
 * build time, so there is no second copy of it to drift, and a region that
 * stops making the call fails the build here rather than rendering a probe
 * seeded with nothing.
 */
export default function Probe({ package: pkg, probe: name }: ProbeProps) {
  const probe = catalogue[pkg]?.[name];

  if (probe === undefined) {
    throw new Error(`no probe '${name}' in '${pkg}'`);
  }

  return <ProbeIsland probePackage={pkg} name={name} initial={seedOf(probe)} />;
}
