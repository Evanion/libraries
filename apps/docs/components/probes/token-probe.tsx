'use client';

import ProbeField from './ProbeField';
import { probes } from './token';
import type { IslandProps } from './islands';

/** `@evanion/token`'s probes, and the package with them, in one chunk. */
export default function TokenProbe({ name, initial }: IslandProps) {
  return (
    <ProbeField probe={probes[name as keyof typeof probes]} initial={initial} />
  );
}
