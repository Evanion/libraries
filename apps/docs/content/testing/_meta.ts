import type { MetaRecord } from 'nextra';

/**
 * Two pages, and the order is the strength of the evidence.
 *
 * The index carries what a reader can check without trusting the author: the
 * executed documentation, the security register with every case rendered from
 * the test that proves it, and the per-package counts. Coverage follows,
 * because a percentage counts lines a run executed and says nothing about
 * assertions, so it is the weakest thing in the section and putting it first
 * would lead with the part a sceptic discounts.
 */
export default {
  index: 'How this project is tested',
  coverage: 'What coverage measures',
} satisfies MetaRecord;
