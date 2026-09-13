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
 * `title` and the order are editorial and are the reason this is not generated:
 * nothing derives "URN" from `urn`, or decides that the widget renderers belong
 * next to each other.
 */

/** Where a package with no section here sends the reader. */
const repository = 'https://github.com/Evanion/libraries/tree/main';

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
}

export const packages: readonly DocumentedPackage[] = [
  {
    name: '@evanion/compose',
    root: 'libs/compose',
    slug: 'compose',
    title: 'Compose',
    documented: true,
  },
  {
    name: '@evanion/react-widget',
    root: 'libs/widget',
    slug: 'widget',
    title: 'React Widget',
    documented: true,
  },
  {
    name: '@evanion/astro-widget',
    root: 'libs/astro-widget',
    slug: 'astro-widget',
    title: 'Astro Widget',
    documented: true,
  },
  {
    name: '@evanion/urn',
    root: 'libs/urn',
    slug: 'urn',
    title: 'URN',
    documented: true,
  },
  {
    name: '@evanion/token',
    root: 'libs/token',
    slug: 'token',
    title: 'Token',
    documented: true,
  },
  {
    name: '@evanion/luhn',
    root: 'libs/luhn',
    slug: 'luhn',
    title: 'Luhn',
    documented: true,
  },
  {
    name: '@evanion/feature',
    root: 'libs/feature',
    slug: 'feature',
    title: 'Feature Toggles',
    documented: true,
  },
  {
    name: '@evanion/nestjs-correlation-id',
    root: 'nest/correlation-id',
    slug: 'nestjs-correlation-id',
    title: 'NestJS Correlation ID',
    documented: true,
  },
  {
    name: '@evanion/baize-ui',
    root: 'libs/baize-ui',
    slug: 'baize-ui',
    title: 'Baize UI',
    documented: true,
  },
];

/** The README that stands in for a package with no section on this site. */
export function readmeUrl(entry: DocumentedPackage): string {
  return `${repository}/${entry.root}#readme`;
}
