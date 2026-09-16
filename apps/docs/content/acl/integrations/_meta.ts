import type { MetaRecord } from 'nextra';

/**
 * The four platforms `@evanion/acl` can be wired into today.
 *
 * Server-only first, because the trust boundary is simplest there and the two
 * React pages build on it: an RSC graph and a React Router 8 app both put the
 * authoritative decision on the server and send the document to a client that
 * re-renders without enforcing.
 *
 * `index` is the page the `integrations` key in `content/acl/_meta.ts` resolves
 * to, and `tools/repo-checks/src/docs-navigation.test.ts` fails on a key here
 * that names no page.
 */
export default {
  index: 'Overview',
  express: 'Express',
  nestjs: 'NestJS',
  'next-rsc': 'Next.js RSC',
  'react-router': 'React Router 8',
} satisfies MetaRecord;
