import { categorical } from '@evanion/baize-ui/tokens';
import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The invariant: the docs site's navigation names every package the repository
 * releases.
 *
 * Five packages went undocumented and what let it happen is that nothing was the
 * list. Nextra builds its sidebar from `_meta` files, which are ES modules
 * bundled into the page map: they cannot read the filesystem and they cannot ask
 * the Nx project graph what exists, so the set of packages has to be written down
 * somewhere a bundler can reach, and `apps/docs/app/navigation.ts` is that place.
 *
 * This file is the other half, on the same pattern as
 * `commitlint-scope-enum.test.ts`: the static list is held against the project
 * graph here, where computing the graph is affordable. Adding a package under
 * `libs/` or `nest/` fails this test until the site says something about it.
 *
 * The titles and the order are not checked. They are editorial -- nothing derives
 * "URN" from `urn` -- and they are the reason the list is not generated.
 */

/** What `apps/docs/app/navigation.ts` exports, restated rather than imported.
 *
 * A `import type` across the project boundary would put an app's source inside
 * this project's compilation, which its tsconfig does not include. The shape is
 * checked by the assertions below either way. */
interface DocumentedPackage {
  name: string;
  root: string;
  slug: string;
  title: string;
  documented: boolean;
  workshop: boolean;
  group: string;
  familyId?: string;
  framework: string;
  hue: string;
}

interface PackageGroup {
  id: string;
  title: string;
  line: string;
}

interface ReleasedProject {
  name: string;
  root: string;
}

const docsRoot = join(workspaceRoot, 'apps', 'docs');
const contentRoot = join(docsRoot, 'content');

async function loadNavigation(): Promise<readonly DocumentedPackage[]> {
  return (await loadNavigationModule()).packages;
}

async function loadGroups(): Promise<readonly PackageGroup[]> {
  return (await loadNavigationModule()).groups;
}

async function loadNavigationModule(): Promise<{
  packages: readonly DocumentedPackage[];
  groups: readonly PackageGroup[];
}> {
  return (await import(
    pathToFileURL(join(docsRoot, 'app', 'navigation.ts')).href
  )) as {
    packages: readonly DocumentedPackage[];
    groups: readonly PackageGroup[];
  };
}

/**
 * The projects `nx release` versions, which is what "a released package" means
 * here. Read from `nx.json` rather than restated, so the one exclusion it carries
 * -- the private design system -- is honoured by this test as well.
 *
 * `nx.json` carries `//` comments, so it is read with the comment-tolerant parser
 * Nx itself reads it with.
 */
const released: Promise<ReleasedProject[]> = (async () => {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  if (!patterns) throw new Error('nx.json must define release.projects');

  const graph = await createProjectGraphAsync({ exitOnError: false });
  const names = findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    graph.nodes,
  );

  return names.map((name) => {
    const node = graph.nodes[name];
    if (!node)
      throw new Error(`${name} matched release.projects but is not a node`);
    return { name, root: node.data.root };
  });
})();

/** Every `_meta` module under `content/`, with the directory it orders. */
async function metaFiles(): Promise<
  { directory: string; meta: Record<string, unknown> }[]
> {
  const found: { directory: string; meta: Record<string, unknown> }[] = [];

  const walk = async (directory: string): Promise<void> => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(path);
      } else if (/^_meta\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        const module_ = (await import(pathToFileURL(path).href)) as {
          default: Record<string, unknown>;
        };
        found.push({ directory, meta: module_.default });
      }
    }
  };

  await walk(contentRoot);
  return found;
}

/** Whether a `_meta` key resolves to a page Nextra will find. */
function pageExists(directory: string, name: string): boolean {
  return ['.mdx', '.md'].some(
    (extension) =>
      existsSync(join(directory, `${name}${extension}`)) ||
      existsSync(join(directory, name, `index${extension}`)),
  );
}

describe('the docs navigation', () => {
  it('names every released package', async () => {
    const projects = await released;

    expect(
      projects.length,
      'release.projects matched no projects -- the globs or the graph are wrong',
    ).toBeGreaterThan(0);

    const listed = new Set((await loadNavigation()).map((entry) => entry.name));

    expect(
      projects
        .map((project) => project.name)
        .filter((name) => !listed.has(name))
        .sort(),
      'Add these to `packages` in apps/docs/app/navigation.ts. A released ' +
        'package missing from it is one the docs site never mentions, which is ' +
        'how five of them stayed undocumented.',
    ).toEqual([]);
  });

  /**
   * The other direction, and the reason it is `release.projects` rather than the
   * whole project graph: this site is what a reader reaches from npm, so every
   * section on it has to be something that reader can install. A project the
   * repository does not release cannot be -- `@evanion/baize-ui` is `private:
   * true`, exists to style the demo apps in this workspace, and `npm install`
   * does not resolve it. Its manual is `libs/baize-ui/README.md`, where a
   * contributor is the audience.
   *
   * Widening this to the project graph admits every app, every tool and every
   * private library, which is the whole repository rather than its published
   * surface.
   */
  it('names nothing the repository does not release', async () => {
    const names = new Set((await released).map((project) => project.name));

    expect(
      (await loadNavigation())
        .map((entry) => entry.name)
        .filter((name) => !names.has(name)),
      'Remove these from `packages` in apps/docs/app/navigation.ts, or release ' +
        'the package. A reader arriving from npm cannot install what the ' +
        'repository does not publish.',
    ).toEqual([]);
  });

  it('gives every package the directory the project graph gives it', async () => {
    const roots = new Map(
      (await released).map((project) => [project.name, project.root]),
    );
    const navigation = await loadNavigation();

    expect(navigation.map((entry) => `${entry.name} ${entry.root}`)).toEqual(
      navigation.map((entry) => `${entry.name} ${roots.get(entry.name)}`),
    );
  });

  /**
   * The landing page and the sidebar both order by `groups` and drop a package
   * whose `group` matches no entry, silently -- `filter` on a key nothing has
   * returns an empty list, and an empty group renders nothing at all. A typo
   * would take the package off both without failing a build.
   */
  it('puts every package in a group that exists', async () => {
    const ids = new Set((await loadGroups()).map((group) => group.id));

    expect(
      (await loadNavigation())
        .filter((entry) => !ids.has(entry.group))
        .map((entry) => `${entry.slug}: ${entry.group}`),
      'Every package needs a `group` naming one of `groups` in ' +
        'apps/docs/app/navigation.ts. A package in no group is on neither the ' +
        'landing page nor the sidebar.',
    ).toEqual([]);
  });

  /** The card says what stack a package runs in, so every card needs one. */
  it('says what stack every package runs in', async () => {
    expect(
      (await loadNavigation())
        .filter((entry) => entry.framework.trim() === '')
        .map((entry) => entry.slug),
    ).toEqual([]);
  });

  /**
   * A package's hue is its identity on the cards and on its own pages, so two
   * packages sharing one is worse than neither having one: the reader learns a
   * colour that means two things. A hue the scale does not carry resolves to an
   * undefined custom property and renders as the ground, silently.
   *
   * One sharing is allowed: within a group. The rendering group's three
   * packages are one family, so they carry one hue to say so — the same way
   * `feature` (universal + React) uses one. A hue must still be distinct across
   * groups, or a reader scanning the cards learns one colour for two unrelated
   * packages.
   */
  it('gives every package a hue from the scale, distinct across groups', async () => {
    const navigation = await loadNavigation();

    expect(
      navigation
        .map((entry) => entry.hue)
        .filter((hue) => !(hue in categorical)),
      `Every \`hue\` in apps/docs/app/navigation.ts has to name one of ` +
        `\`categorical\` in @evanion/baize-ui/tokens.`,
    ).toEqual([]);

    // Within one group a hue may repeat (a family); across groups it may not.
    // Dedupe each group's hues first, so a family's shared hue counts once.
    const byGroup = new Map<string, string[]>();
    for (const entry of navigation) {
      const group = entry.group;
      byGroup.set(group, [...(byGroup.get(group) ?? []), entry.hue]);
    }
    const acrossGroups = [...byGroup.values()].flatMap(
      (hues) => [...new Set(hues)],
    );
    expect(
      acrossGroups,
      'Two packages in different groups sharing one colour teaches a reader ' +
        'a colour that means two unrelated things.',
    ).toEqual([...new Set(acrossGroups)]);
  });

  it('lists every package once', async () => {
    const slugs = (await loadNavigation()).map((entry) => entry.slug);

    expect(slugs).toEqual([...new Set(slugs)]);
  });

  /**
   * `workshop` is what puts a package under the sidebar's Workshop separator,
   * into the second grid on the landing page, and behind a notice on every one
   * of its pages saying `npm install` does not resolve. `private: true` in the
   * package's own manifest is the same statement -- it is what makes
   * `nx release publish` skip it -- so the two are held equal here rather than
   * maintained side by side. Publishing a package is then one edit, to its
   * manifest, and the site follows.
   */
  it('marks as Workshop exactly the packages that are private', async () => {
    const navigation = await loadNavigation();

    expect(
      navigation.map((entry) => `${entry.slug} ${entry.workshop}`),
      'Set `workshop` on the entry in apps/docs/app/navigation.ts to match ' +
        '`private` in the package manifest, or change the manifest. A reader ' +
        'told to `npm install` a private package gets nothing.',
    ).toEqual(
      navigation.map((entry) => {
        const manifest = parseJson<{ private?: boolean }>(
          readFileSync(
            join(workspaceRoot, entry.root, 'package.json'),
            'utf-8',
          ),
        );

        return `${entry.slug} ${manifest.private === true}`;
      }),
    );
  });

  /**
   * `documented` is what chooses between a section on this site and a link to
   * the package's README, and Nextra fails the build on a `_meta` key naming a
   * page it cannot find. Holding the flag against the content directory is what
   * makes it flip when the section lands, rather than a month later.
   */
  it('says which packages have a section here, and is right', async () => {
    const navigation = await loadNavigation();

    expect(
      navigation.map((entry) => `${entry.slug} ${entry.documented}`),
    ).toEqual(
      navigation.map(
        (entry) =>
          `${entry.slug} ${existsSync(join(contentRoot, entry.slug, 'index.mdx'))}`,
      ),
    );
  });
});

describe('every _meta file', () => {
  it('is found', async () => {
    expect((await metaFiles()).length).toBeGreaterThan(0);
  });

  /**
   * Nextra throws `Validation of "_meta" file has failed` during the build for a
   * key that names no page and carries no `href`
   * (nextra/dist/server/page-map/normalize.js). A renamed or deleted page is how
   * that happens; failing here names the key rather than failing a deploy.
   */
  it('names only pages that exist', async () => {
    const dangling: string[] = [];

    for (const { directory, meta } of await metaFiles()) {
      for (const [key, item] of Object.entries(meta)) {
        // The same three exemptions Nextra's own normalizer grants: a separator,
        // a menu, and anything carrying an `href`. `content/_meta.ts` emits a
        // separator to head the Workshop group.
        const isChrome =
          typeof item === 'object' &&
          item !== null &&
          ('href' in item ||
            ('type' in item &&
              (item.type === 'separator' || item.type === 'menu')));

        if (!isChrome && !pageExists(directory, key)) {
          dangling.push(`${relative(workspaceRoot, directory)}: ${key}`);
        }
      }
    }

    expect(dangling).toEqual([]);
  });
});
