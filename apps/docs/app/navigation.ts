/**
 * Every package this site is responsible for, in sidebar order.
 *
 * The list exists because Nextra builds its navigation from `_meta` files, and a
 * `_meta` file is an ES module bundled into the page map -- it cannot read the
 * filesystem and it cannot ask the Nx project graph what packages exist. So the
 * set of packages has to be written down somewhere a bundler can reach, and this
 * is that place: `content/_meta.ts` is built from it rather than typed out again.
 *
 * A written-down list drifts, which is how five packages ended up with no
 * documentation and nothing to say so. `tools/repo-checks/src/docs-navigation.test.ts`
 * is the other half: it computes the same set from `nx.json`'s `release.projects`
 * and fails when the two disagree, on the same pattern as `scope-enum` in
 * commitlint.config.js. Adding a package to the repository fails that test until
 * it is added here.
 *
 * `title`, `group` and the order are editorial and are the reason this is not
 * generated: nothing derives "URN" from `urn`, or decides that the widget
 * renderers belong next to each other.
 */

import type { CategoricalHue } from '@evanion/baize-ui/tokens';

/** Where a package with no section here sends the reader. */
const repository = 'https://github.com/Evanion/libraries/tree/main';

export interface PackageGroup {
  /** The key `content/_meta.ts` gives this group's sidebar separator. */
  id: string;
  /** What the separator and the landing-page section are called. */
  title: string;
  /**
   * The group's own line on the landing page. The sidebar shows only the title.
   *
   * For a group whose section is a teaser and a demonstration this is the only
   * prose the section carries -- the teaser is a name and a chip per runtime --
   * so it has to name each runtime in words. A reader scanning for "astro" or
   * for "react" finds it here.
   *
   * Which shape a group takes on the landing page -- a line beside the family
   * teasers, a card each, a row each -- is the page's decision and lives in
   * `components/landing/items.ts`, where each group is an item of one type.
   */
  line: string;
}

/**
 * The axis the landing page and the sidebar are ordered on: what problem a
 * package is for.
 *
 * Eight equal cards in one list gave a reader arriving with a problem nothing to
 * scan against, and it hid the one relationship on the site that matters --
 * `react-widget` and `astro-widget` are the same model in two runtimes, and
 * adjacency alone never said so. The rendering group's line says it in words.
 *
 * One axis, not two. Whether a package is on npm is a property of the package
 * and rides on its card next to the framework, rather than pulling it out of the
 * group a reader would look for it in.
 *
 * Ordered by how much of an application the group decides, widest first, with
 * the catch-all last. Rendering and authorization each shape a whole interface
 * and each is a core sold across runtimes, so they lead and they are the two
 * sections that carry a working demonstration; identifiers and codes act on one
 * string at a time and follow.
 */
export const groups: readonly PackageGroup[] = [
  {
    id: 'rendering',
    title: 'Rendering from data',
    line: 'Describe a page as data: a list of items, each naming a component and the props it takes. The library resolves every item to its component by type, checks the props against it at compile time, and renders the page. One item shape, held in a framework-free core, rendered by React and by Astro.',
  },
  {
    id: 'acl',
    title: 'Authorization from one policy',
    line: 'Write authorization down once: the objects, the actions, and the condition each one turns on. The policy builds to a frozen document that round-trips through JSON and is evaluated in place, so the rules guarding an endpoint are the same rules that decide which buttons a browser draws, with no round trip to ask and no per-subject snapshot to keep in step. One policy, held in a framework-free core, bound to React.',
  },
  {
    id: 'identifiers',
    title: 'Identifiers and codes',
    line: 'Naming a thing, signing an identifier so a typo is caught before the database is, and minting a code a person can read back over the phone. Token is built on Luhn.',
  },
  {
    id: 'standalone',
    title: 'On their own',
    line: 'One problem each, sharing a domain with nothing else here.',
  },
];

export interface DocumentedPackage {
  /** The published package name. */
  name: string;
  /** The package's directory in this repository. */
  root: string;
  /** Its folder under `content/`, and the first segment of its URL. */
  slug: string;
  /** What the sidebar calls it. */
  title: string;
  /**
   * Whether `content/<slug>/` exists.
   *
   * Nextra throws on a `_meta` key that names no page, so a package waiting for
   * its section cannot simply be listed: it is listed as a link to the README
   * that documents it today. The flag is what chooses between the two, and the
   * repo-checks test asserts it against the content directory, so it cannot be
   * left behind when the section lands.
   */
  documented: boolean;
  /**
   * Whether the package's own `package.json` carries `private: true`.
   *
   * `private: true` is what makes `nx release publish` skip a package, so it is
   * already the statement "this is not on npm". The card says so next to the
   * framework, and `WorkshopNotice` says it at the top of every one of the
   * package's pages, because a reader arriving from a search result sees neither
   * the cards nor the sidebar.
   *
   * Written down here for the same reason the rest of this list is -- a `_meta`
   * module is bundled and cannot read a manifest -- and held against the
   * manifests by `tools/repo-checks/src/docs-navigation.test.ts`, so taking
   * `private` off a package moves it out of Workshop or fails the build.
   */
  workshop: boolean;
  /** Which entry of `groups` this package sits under. */
  group: string;
  /**
   * The family a package belongs to, set only where several packages are one
   * thing sold across runtimes.
   *
   * A core and its renderers are one family, so the landing shows them as one
   * card carrying a chip per platform. `widget` names the widget core and both
   * renderers; `acl` the access-control core and its binding. A
   * standalone package is its own family and omits `familyId` — there is
   * nothing to group it with. Adding a Svelte or Vue adapter to an existing
   * family only adds a chip and a link, never a card.
   */
  familyId?: string;
  /**
   * The stack the package runs in, as a chip on its card.
   *
   * `universal` is the answer for a package that imports no framework: it runs
   * wherever TypeScript does, and `any` said that to nobody. `@evanion/feature`
   * says `universal + React` because both halves are true and dropping either
   * misleads: the core imports no framework and the React adapter is a
   * separate entry point. Each word has to be one
   * `components/landing/platforms.ts` can paint.
   */
  framework: string;
  /**
   * The package's identity colour, from the categorical scale in
   * `@evanion/baize-ui/tokens`.
   *
   * Baize has no house colour and the catalogue supplies every saturated pixel.
   * This site's catalogue is the packages, so the packages are what carries the
   * colour -- without them the design is a green page on a green ground, which
   * is what it was. A reader scanning for one package finds it by colour before
   * reading a word, and a reader who has been in `@evanion/urn`'s pages
   * recognises its periwinkle on a card.
   *
   * One hue each and no two alike: `tools/repo-checks/src/docs-navigation.test.ts`
   * fails on a repeat, because two packages in one colour is worse than none,
   * and on a name the scale does not carry.
   */
  hue: CategoricalHue;
}

export const packages: readonly DocumentedPackage[] = [
  {
    name: '@evanion/react-widget',
    root: 'libs/react-widget',
    slug: 'react-widget',
    title: 'React Widget',
    group: 'rendering',
    familyId: 'widget',
    framework: 'React',
    hue: 'sky',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/astro-widget',
    root: 'libs/astro-widget',
    slug: 'astro-widget',
    title: 'Astro Widget',
    group: 'rendering',
    familyId: 'widget',
    framework: 'Astro',
    // The rendering group is one family, so its three packages share one hue —
    // the same way `feature` (universal + React) uses one. A reader who has
    // been in the React Widget pages recognises the family by colour.
    hue: 'sky',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/widget',
    root: 'libs/widget',
    slug: 'widget',
    title: 'Widget',
    group: 'rendering',
    familyId: 'widget',
    framework: 'universal',
    // One hue for the whole rendering family, including the framework-free core.
    hue: 'sky',
    // The section this package wants is the shared half of the two renderers'
    // pages, which is a docs restructure rather than part of a migration. Until
    // it is written the sidebar links to the README.
    documented: false,
    workshop: false,
  },
  {
    name: '@evanion/acl',
    root: 'libs/acl',
    slug: 'acl',
    title: 'Authorization',
    group: 'acl',
    familyId: 'acl',
    framework: 'universal',
    hue: 'coral',
    documented: true,
    workshop: true,
  },
  {
    name: '@evanion/react-acl',
    root: 'libs/react-acl',
    slug: 'react-acl',
    title: 'React Authorization',
    group: 'acl',
    familyId: 'acl',
    framework: 'React',
    // `stone` is the unsaturated hue on the categorical scale, for a member
    // with no colour of its own. The React binding has no colour of its own
    // either, and its core already took `coral`.
    hue: 'stone',
    documented: false,
    workshop: true,
  },
  {
    name: '@evanion/urn',
    root: 'libs/urn',
    slug: 'urn',
    title: 'URN',
    group: 'identifiers',
    framework: 'universal',
    hue: 'periwinkle',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/luhn',
    root: 'libs/luhn',
    slug: 'luhn',
    title: 'Luhn',
    group: 'identifiers',
    framework: 'universal',
    hue: 'citron',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/token',
    root: 'libs/token',
    slug: 'token',
    title: 'Token',
    group: 'identifiers',
    framework: 'universal',
    hue: 'teal',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/compose',
    root: 'libs/compose',
    slug: 'compose',
    title: 'Compose',
    group: 'standalone',
    framework: 'React',
    hue: 'orchid',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/nestjs-correlation-id',
    root: 'nest/correlation-id',
    slug: 'nestjs-correlation-id',
    title: 'Correlation ID',
    group: 'standalone',
    framework: 'NestJS',
    hue: 'mint',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/feature',
    root: 'libs/feature',
    slug: 'feature',
    title: 'Feature',
    group: 'standalone',
    framework: 'universal + React',
    hue: 'amber',
    documented: true,
    workshop: true,
  },
];

/** The README that stands in for a package with no section on this site. */
export function readmeUrl(entry: DocumentedPackage): string {
  return `${repository}/${entry.root}#readme`;
}
