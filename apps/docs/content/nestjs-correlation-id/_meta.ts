import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/nestjs-correlation-id` in: what an id
 * carried across a request buys them, the module and middleware registration
 * that turns it on, then the fields that change the header, the generator and
 * the validation. Configuration follows getting started because every field it
 * documents has a default the registration above already uses.
 *
 * Without this file Nextra orders the folder by filename, which opens the
 * section on the API reference. The labels drop the package name the pages
 * repeat: the section is already called Correlation ID.
 *
 * A page not listed here is appended after these, so adding one is not a
 * requirement. Renaming one is: Nextra fails the build on a key naming a page it
 * cannot find, and `tools/repo-checks/src/docs-navigation.test.ts` fails first.
 */
export default {
  index: 'Overview',
  'getting-started': 'Getting Started',
  configuration: 'Configuration',
  api: 'API Reference',
} satisfies MetaRecord;
