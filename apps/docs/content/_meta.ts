import type { MetaRecord } from 'nextra';
import { packages, readmeUrl } from '../app/navigation';

/**
 * The top level of the sidebar, built from `app/navigation.ts`.
 *
 * Written as a derivation rather than as a literal object so that there is one
 * list of packages in this app and not two. A package with no section here is
 * still listed, pointing at the README that documents it today -- Nextra throws
 * on a `_meta` key naming a page it cannot find, so the alternative is leaving
 * the package out of the navigation entirely, which is the failure this file
 * exists to prevent.
 */
export default {
  index: 'Introduction',
  ...Object.fromEntries(
    packages.map((entry) => [
      entry.slug,
      entry.documented
        ? entry.title
        : { title: entry.title, href: readmeUrl(entry) },
    ]),
  ),
} satisfies MetaRecord;
