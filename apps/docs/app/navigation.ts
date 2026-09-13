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
   * For a `combined` group this is the card's body -- the one description both
   * packages share -- so it has to name each runtime in words. A reader scanning
   * for "astro" finds it here.
   */
  line: string;
  /**
   * Whether the group is one card with a link to each package, rather than a
   * card each.
   *
   * The two widget renderers are one model in two runtimes, and two cards side
   * by side said nothing about that -- a reader took them for unrelated
   * packages. One card whose body describes the model once, with a button
   * through to each runtime, is the relationship stated structurally. It is a
   * landing-page presentation only: each package keeps its own section in the
   * sidebar and its own pages.
   */
  combined?: boolean;
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
 */
export const groups: readonly PackageGroup[] = [
  {
    id: 'rendering',
    title: 'Rendering from data',
    line: 'One model in two runtimes: a list of structured items, a map of the components that render them, and no provider in either. React Widget renders a region of React components, with each item checked against its component at compile time. Astro Widget renders Astro sections from CMS block data, at build time, shipping nothing to the browser.',
    combined: true,
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
   * The stack the package runs in, as one short marker on its card.
   *
   * `any` is the real answer for a package that imports no framework, and the
   * page said nothing about those at all -- a reader could not tell that URN,
   * Luhn and Token work anywhere. `@evanion/feature` says `any + React` because
   * both halves are true and dropping either misleads: the core imports no
   * framework and the React adapter is a separate entry point.
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
    root: 'libs/widget',
    slug: 'widget',
    title: 'React Widget',
    group: 'rendering',
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
    framework: 'Astro',
    hue: 'coral',
    documented: true,
    workshop: false,
  },
  {
    name: '@evanion/urn',
    root: 'libs/urn',
    slug: 'urn',
    title: 'URN',
    group: 'identifiers',
    framework: 'any',
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
    framework: 'any',
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
    framework: 'any',
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
    title: 'NestJS Correlation ID',
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
    title: 'Feature Toggles',
    group: 'standalone',
    framework: 'any + React',
    hue: 'amber',
    documented: true,
    workshop: true,
  },
];

/** The README that stands in for a package with no section on this site. */
export function readmeUrl(entry: DocumentedPackage): string {
  return `${repository}/${entry.root}#readme`;
}
