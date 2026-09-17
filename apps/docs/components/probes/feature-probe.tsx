'use client';

import ProbeField from './ProbeField';
import { probes } from './feature';
import type { IslandProps } from './islands';

/** `@evanion/feature`'s probes, and the package with them, in one chunk. */
export default function FeatureProbe({ name, initial }: IslandProps) {
  return (
    <ProbeField probe={probes[name as keyof typeof probes]} initial={initial} />
  );
}
