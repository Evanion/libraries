'use client';

import ProbeField from './ProbeField';
import { probes } from './luhn';
import type { IslandProps } from './islands';

/** `@evanion/luhn`'s probes, and the package with them, in one chunk. */
export default function LuhnProbe({ name, initial }: IslandProps) {
  return (
    <ProbeField probe={probes[name as keyof typeof probes]} initial={initial} />
  );
}
