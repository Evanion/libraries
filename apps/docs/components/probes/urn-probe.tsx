'use client';

import ProbeField from './ProbeField';
import { probes } from './urn';
import type { IslandProps } from './islands';

/** `@evanion/urn`'s probes, and the package with them, in one chunk. */
export default function UrnProbe({ name, initial }: IslandProps) {
  return (
    <ProbeField probe={probes[name as keyof typeof probes]} initial={initial} />
  );
}
