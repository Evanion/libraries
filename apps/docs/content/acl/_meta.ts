import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/acl` in: what it is, the document it
 * evaluates, how a policy is written, what comes back, the field axis, and what
 * the library does not cover.
 *
 * The security contract sits last of the prose pages and before the reference
 * because it is what a reader returns to, not what they start with — but it is
 * linked from the overview, so nobody reaches production without passing it.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. A page not listed here is appended after these;
 * renaming one fails the build, and
 * `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  matrix: 'The Matrix Document',
  authoring: 'Typed Authoring',
  decisions: 'Decisions',
  fields: 'Field Permissions',
  security: 'Security Contract',
  api: 'API Reference',
} satisfies MetaRecord;
