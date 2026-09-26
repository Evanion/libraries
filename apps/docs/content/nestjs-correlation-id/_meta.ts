import type { MetaRecord } from 'nextra';

/**
 * The order a reader meets `@evanion/nestjs-correlation-id` in: how one id
 * travels across services, the module and middleware registration that puts an
 * id on every request, then the two places an id goes beyond the request that
 * brought it (an outgoing HTTP call, and a job with no request behind it), then
 * the fields `forRoot()` takes. Configuration comes after the jobs page because
 * the jobs page reads the resolved configuration's `validate`, and every field
 * configuration documents has a default the registration already uses.
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
  forwarding: 'Forwarding to the Next Service',
  jobs: 'Jobs With No Request',
  configuration: 'Configuration',
  api: 'API Reference',
} satisfies MetaRecord;
