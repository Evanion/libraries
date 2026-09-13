import type { MetaRecord } from 'nextra';
import { packages, readmeUrl } from '../app/navigation';

/** How a package appears in the sidebar: a section, or a link to its README. */
function entry(item: (typeof packages)[number]) {
  return item.documented
    ? item.title
    : { title: item.title, href: readmeUrl(item) };
}

/** The packages on one side of the Workshop separator, keyed by slug. */
function section(workshop: boolean) {
  return Object.fromEntries(
    packages
      .filter((item) => item.workshop === workshop)
      .map((item) => [item.slug, entry(item)]),
  );
}

const published = section(false);
const workshop = section(true);

/**
 * The top level of the sidebar, built from `app/navigation.ts`.
 *
 * Written as a derivation rather than as a literal object so that there is one
 * list of packages in this app and not two. A package with no section here is
 * still listed, pointing at the README that documents it today -- Nextra throws
 * on a `_meta` key naming a page it cannot find, so the alternative is leaving
 * the package out of the navigation entirely, which is the failure this file
 * exists to prevent.
 *
 * The Workshop separator sits above the packages whose `package.json` carries
 * `private: true`, the same flag that makes `nx release publish` skip them.
 * Taking the flag off moves a package above the separator with no edit here. The
 * separator is omitted when nothing is private, because Nextra renders one
 * whether or not anything follows it.
 */
export default {
  index: 'Introduction',
  ...published,
  ...(Object.keys(workshop).length > 0
    ? { workshop: { type: 'separator', title: 'Workshop' }, ...workshop }
    : {}),
} satisfies MetaRecord;
