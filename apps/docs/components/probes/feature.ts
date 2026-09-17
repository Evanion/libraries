import { inRollout } from '@evanion/feature';

import { quote, type Probe } from './probe';

/**
 * `inRollout` over a customer id the reader types.
 *
 * The claim a rollout rests on is invisible in prose: the answer for one
 * customer is the same on every request, from every process, and it is not a
 * coin flip weighted to ten percent. Retyping the id is what shows it -- the
 * same id always comes back the same, a neighbouring id lands anywhere, and
 * roughly one id in ten is in. A shop rolling the new checkout out to a tenth
 * of its customers needs that tenth to be the same tenth tomorrow.
 *
 * The percentage and the flag key are fixed, so the only thing that varies is
 * the customer, which is the axis the property is about.
 */
export const rollout: Probe = {
  label: 'customer id',
  hint: 'Retype the id. The same customer always lands in the same place, and about one in ten is in.',
  call: (customerId) => inRollout(customerId, 10, 'new-checkout'),
  source: (customerId) => `inRollout(${quote(customerId)}, 10, 'new-checkout')`,
  region: { file: 'libs/feature/README.md', name: 'rollout' },
};

export const probes = { rollout };
