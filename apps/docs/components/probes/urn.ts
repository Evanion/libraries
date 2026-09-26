import { URN } from '@evanion/urn';

import { quote, type Probe } from './probe';

/**
 * The class the README's components block declares, so the call this probe
 * writes is the call that block makes. `parse` is inherited rather than
 * overridden -- `GameURN.parse === URN.parse` -- so what runs is the
 * package's own export, and a subclass is only how the block names a
 * namespace.
 */
export class GameURN extends URN {
  static override readonly nid = 'game';
}

/**
 * `parse` over a URN the reader types.
 *
 * The r-, q- and f-components come off in a fixed order that the prose takes
 * three numbered steps to state: `#` first, then `?+`, then `?=`. Adding one
 * delimiter at a time to the field is that order made visible, and a bare `?`
 * throwing is the rule about legal introducers. A foreign NID stays in the
 * `nss` here too, which is the other thing this class's `parse` does.
 */
export const components: Probe = {
  label: 'urn',
  hint: 'Put ?+lang=en before ?= for an r-component, or a bare ? to see it refused.',
  call: (value) => GameURN.parse(value),
  source: (value) => `GameURN.parse(${quote(value)})`,
  region: { file: 'libs/urn/README.md', name: 'components' },
};

export const probes = { components };
