import type { MetaRecord } from 'nextra';

/**
 * Three pages, and the order is the strength of the evidence.
 *
 * The index says which libraries the section counts, how the documentation's
 * examples run as tests, and how to rerun any figure from a clone. The security
 * register follows with the thirty-six `@evanion/acl` cases, each rendered from
 * the test that proves it, and it is a page of its own so the index stays
 * readable before a reader meets thirty-six test bodies. Coverage comes last,
 * because a percentage counts lines a run executed and says nothing about
 * assertions, so it is the weakest evidence in the section.
 */
export default {
  index: 'How the libraries are tested',
  'security-register': 'The acl security register',
  coverage: 'What coverage measures',
} satisfies MetaRecord;
