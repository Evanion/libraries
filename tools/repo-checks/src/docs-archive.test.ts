import { workspaceRoot } from '@nx/devkit';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { pinFaults, type Pin, type PinInputs } from './docs-archive';
import {
  CONTENT,
  DOCS,
  NEXT,
  servedSections,
  type ServedVersion,
} from './docs-content';

/**
 * The invariant: each package's bare path serves its current line's x.y.0
 * release and names the line's newest release as the one on npm, every
 * version directory holds what its release shipped and nothing that resolves
 * against `main`, and the pin file says only true things about releases.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 11 lists the guards,
 * ordered by how silently each failure ships. The ones over the static export
 * are `docs-export.test.ts`'s. These read the repository and the directories
 * `nx run docs:archives` wrote, which this project's test target depends on.
 */

interface DocumentedPackage {
  name: string;
  slug: string;
  documented: boolean;
  workshop: boolean;
  unversioned?: string;
}

async function load<T>(path: string): Promise<T> {
  return (await import(pathToFileURL(join(DOCS, path)).href)) as T;
}

const navigation = () =>
  load<{ packages: readonly DocumentedPackage[] }>('app/navigation.ts');
const versions = () =>
  load<{
    segmentOf: (version: string) => string;
    releaseLines: (
      name: string,
      tags: readonly string[],
    ) => {
      segment: string;
      cut: { tag: string; version: string };
      releases: { tag: string; version: string }[];
    }[];
    taggedPast: (
      name: string,
      tags: readonly string[],
      version: string,
    ) => string[];
  }>('tools/versions.mjs');
const seed = () =>
  load<{
    dryRunAt: (root: string, sha: string, name: string) => string | null;
  }>('tools/seed.mjs');
const cut = () =>
  load<{ surfaceFaults: (source: string) => string[] }>('tools/cut.mjs');

function git(args: readonly string[]): string {
  return execFileSync('git', args as string[], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function commit(ref: string): string | null {
  try {
    return git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    return null;
  }
}

function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    git(['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

const tags = git(['tag', '--list']).split('\n').filter(Boolean);
const pins = JSON.parse(
  readFileSync(join(DOCS, 'archives.json'), 'utf-8'),
) as Record<string, Record<string, Pin>>;

/** A release line's directory inside a bare section: `v1`, `v0.2`. */
const LINE = /^v\d+(\.\d+)?$/;

/**
 * The pages of one version directory: every `.mdx` under it, except the
 * release lines a bare section holds, which are versions of their own.
 */
function pagesIn(directory: string, top = true): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return top && LINE.test(entry.name) ? [] : pagesIn(path, false);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/** Every version directory the generator cut from git, with where it is. */
function cutVersions(): {
  at: string;
  directory: string;
  served: ServedVersion;
}[] {
  return Object.entries(servedSections()).flatMap(([slug, section]) => [
    ...(section.current.from === 'cut'
      ? [
          {
            at: `/${slug}/`,
            directory: join(CONTENT, slug),
            served: section.current,
          },
        ]
      : []),
    ...section.lines.map((line) => ({
      at: `/${slug}/${line.segment}/`,
      directory: join(CONTENT, slug, line.segment as string),
      served: line,
    })),
  ]);
}

describe('the pin file', () => {
  /**
   * A clone with no tags answers every check here vacuously, which is a guard
   * that cannot fail. `.github/workflows/ci.yml` checks out with
   * `fetch-depth: 0` for this and for the release notice's own tag lookup.
   */
  it('is checked against a repository that has its tags', () => {
    expect(
      tags.length,
      'No release tags in this checkout, so this check reads nothing. Fetch ' +
        'with `fetch-depth: 0`.',
    ).toBeGreaterThan(0);
  });

  it('pins only releases that happened, at commits on main, and says why where it deviates', async () => {
    const { packages } = await navigation();
    const { segmentOf, taggedPast, releaseLines } = await versions();
    const main = commit('origin/main');

    expect(
      main,
      'No origin/main in this checkout, so no pin can be shown to be on it.',
    ).not.toBeNull();

    const { dryRunAt } = await seed();

    expect(
      pinFaults({
        pins,
        packages: packages.filter((entry) => entry.documented),
        commit,
        isAncestor,
        main: main as string,
        dryRunAt: (sha, name) => dryRunAt(workspaceRoot, sha, name),
        segmentOf,
        taggedPast: (name, version) => taggedPast(name, tags, version),
        releaseLines: (name) => releaseLines(name, tags),
      }),
      'apps/docs/archives.json decides what a release is documented by. ' +
        'docs/specs/2026-09-13-released-by-default.md § 7 is what a pin may say.',
    ).toEqual([]);
  });
});

describe('the generated sections', () => {
  /**
   * § 11.3: a release that reached npm and whose documentation was not cut
   * leaves the site calling an old version current, with no error anywhere. A
   * patch release is documented by its x.y.0, so the bare path is that
   * release's, and it names the patch as the version on npm.
   */
  it("serve each package's newest x.y.0 release at its bare path, naming its newest release", async () => {
    const { packages } = await navigation();
    const { releaseLines } = await versions();
    const sections = servedSections();

    const wrong = packages
      .filter((entry) => entry.documented && !entry.unversioned)
      .flatMap((entry) => {
        // A workshop package publishes nothing, whatever a release run tagged.
        const [line] = entry.workshop ? [] : releaseLines(entry.name, tags);
        // `null` on both sides is a package with no release, served from main.
        const wanted = `${line?.cut.version ?? null} for ${line?.releases[0]?.version ?? null}`;
        const section = sections[entry.slug];
        const served = section
          ? `${section.current.version} for ${section.current.published}`
          : 'nothing';

        return served === wanted
          ? []
          : [`/${entry.slug}/ serves ${served}, and should serve ${wanted}`];
      });

    expect(wrong).toEqual([]);
  });

  /**
   * § 11.4: a copy step that dropped files leaves a section with fewer pages
   * than its release shipped and nothing to say so.
   */
  it('hold every page their release shipped', () => {
    const versions = cutVersions();
    expect(versions.length).toBeGreaterThan(0);

    const short = versions.flatMap(({ at, directory, served }) => {
      if (!existsSync(join(directory, 'index.mdx')))
        return [`${at}: no index.mdx`];

      const shipped = git([
        'ls-tree',
        '-r',
        '--name-only',
        served.sha as string,
        '--',
        `${served.dir}/`,
      ])
        .split('\n')
        .filter((file) => file.endsWith('.mdx')).length;
      const written = pagesIn(directory).length;

      return written >= shipped
        ? []
        : [
            `${at}: ${written} pages, and ${served.dir} at ${served.sha?.slice(0, 7)} has ${shipped}`,
          ];
    });

    expect(short).toEqual([]);
  });

  /** § 11.5: every generated directory was planned, and every plan was written. */
  it('are exactly the directories the plan names', async () => {
    const { packages } = await navigation();
    const sections = servedSections();
    const versioned = packages.filter(
      (entry) => entry.documented && !entry.unversioned,
    );

    const planned = new Set(
      Object.entries(sections).flatMap(([slug, section]) => [
        slug,
        ...section.lines.map((line) => `${slug}/${line.segment}`),
      ]),
    );
    const written = new Set(
      versioned.flatMap((entry) => {
        const bare = join(CONTENT, entry.slug);
        if (!existsSync(bare)) return [];

        return [
          entry.slug,
          ...readdirSync(bare, { withFileTypes: true })
            .filter((child) => child.isDirectory() && LINE.test(child.name))
            .map((child) => `${entry.slug}/${child.name}`),
        ];
      }),
    );

    expect([...written].sort()).toEqual([...planned].sort());
    expect(Object.keys(sections).sort()).toEqual(
      versioned.map((entry) => entry.slug).sort(),
    );
  });

  /**
   * § 11.7: `/next/` exists for exactly the packages that have a bare section.
   * A section in one tree and not the other is a switcher entry that 404s.
   */
  it('have a /next/ tree exactly where they have a bare path', async () => {
    const { packages } = await navigation();

    expect(
      packages
        .filter((entry) => entry.documented)
        .map(
          (entry) =>
            `${entry.slug} ${existsSync(join(NEXT, entry.slug))} ${
              !entry.unversioned && existsSync(join(CONTENT, entry.slug))
            }`,
        ),
    ).toEqual(
      packages
        .filter((entry) => entry.documented)
        .map(
          (entry) =>
            `${entry.slug} ${!entry.unversioned} ${!entry.unversioned}`,
        ),
    );
  });

  /**
   * § 11.11, the second of the three mechanisms. The cut refuses such a page
   * when it writes it; this asks again of what is on disk, so a page edited
   * after the cut, or a cut from before a component was listed, cannot ship.
   */
  it('carry nothing on a cut page that resolves against main', async () => {
    const { surfaceFaults } = await cut();

    const faults = cutVersions().flatMap(({ directory, at }) =>
      pagesIn(directory).flatMap((page) =>
        surfaceFaults(readFileSync(page, 'utf-8')).map(
          (fault) => `${at}${page.slice(directory.length + 1)}: ${fault}`,
        ),
      ),
    );

    expect(faults).toEqual([]);
  });

  /**
   * A reference entry for a function or a class always says what the tests
   * state, even when that is nothing, so an entry without the block is one
   * the cut expanded without its release's behaviour data.
   */
  it('state the behaviours of every function and class on a cut reference page', () => {
    const entry = /<div className="docs-api-entry baize-kind-([a-z-]+)">/;
    let stated = 0;

    const silent = cutVersions().flatMap(({ directory, at }) =>
      pagesIn(directory).flatMap((page) => {
        const [, ...entries] = readFileSync(page, 'utf-8').split(entry);
        const missing = [];
        for (let i = 0; i < entries.length; i += 2) {
          const [kind, body = ''] = [entries[i], entries[i + 1]];
          if (kind !== 'function' && kind !== 'class') continue;
          stated += 1;
          if (!body.includes('What the tests state'))
            missing.push(
              `${at}${page.slice(directory.length + 1)}: ${body.match(/^#+ .*$/m)?.[0]}`,
            );
        }
        return missing;
      }),
    );

    expect(silent).toEqual([]);
    expect(stated).toBeGreaterThan(0);
  });
});

/**
 * The pin rules, against fixtures: one package, a linear history, and a dry
 * run that answers what each case needs. The repository's own pins change with
 * every release, so asserting the rules against them asserts this week.
 */
describe('a pin', () => {
  const history = ['v2tag00', 'tag000', 'docs001', 'fix0002', 'head003'];
  const tagged: Record<string, string> = {
    '@evanion/luhn@2.0.1': 'v2tag00',
    '@evanion/luhn@3.0.0': 'tag000',
  };
  const refs: Record<string, string> = {
    ...tagged,
    elsewhere: 'elsewhere',
    ...Object.fromEntries(history.map((sha) => [sha, sha])),
  };

  let real: Awaited<ReturnType<typeof versions>>;
  beforeAll(async () => {
    real = await versions();
  });

  /** The rules over the fixture's tags, and `later` tags at the head of main. */
  function faults(
    pin: Pin,
    dryRunAt: PinInputs['dryRunAt'] = () => null,
    extra: Record<string, Pin> = {},
    later: readonly string[] = [],
  ): string[] {
    const all = [...Object.keys(tagged), ...later];

    return pinFaults({
      pins: { luhn: { v3: pin, ...extra } },
      packages: [{ name: '@evanion/luhn', slug: 'luhn', workshop: false }],
      commit: (ref) => refs[ref] ?? (later.includes(ref) ? 'head003' : null),
      isAncestor: (a, b) =>
        history.indexOf(a) !== -1 && history.indexOf(a) <= history.indexOf(b),
      main: 'head003',
      dryRunAt,
      segmentOf: real.segmentOf,
      taggedPast: (name, version) => real.taggedPast(name, all, version),
      releaseLines: (name) => real.releaseLines(name, all),
    });
  }

  const release = { version: '3.0.0', tag: '@evanion/luhn@3.0.0' };

  it("passes the release's own tag with no reason", () => {
    expect(faults({ ...release, sha: 'tag000' })).toEqual([]);
  });

  it('refuses a pinned commit the repository does not have', () => {
    expect(faults({ ...release, sha: 'deadbee', reason: 'a re-cut' })).toEqual([
      'luhn.v3: deadbee is not a commit in this repository',
    ]);
  });

  it('refuses a seed of a package nx release would bump', () => {
    expect(
      faults(
        {
          ...release,
          sha: 'fix0002',
          reason:
            'seed: nx release version --dry-run computes 3.0.0 at this SHA',
        },
        () => '3.0.1',
      ),
    ).toEqual([
      'luhn.v3: nx release version --dry-run at fix0002 computes 3.0.1, not 3.0.0',
    ]);
  });

  it('passes a seed nx release versions as the release', () => {
    expect(
      faults({
        ...release,
        sha: 'docs001',
        reason: 'seed: nx release version --dry-run computes 3.0.0 at this SHA',
      }),
    ).toEqual([]);
  });

  it('refuses a commit past the tag that gives no reason', () => {
    expect(faults({ ...release, sha: 'docs001' })).toEqual([
      'luhn.v3: pins a commit past its tag and gives no reason',
    ]);
  });

  it('refuses a commit off the line from the tag to main', () => {
    expect(
      faults({ ...release, sha: 'elsewhere', reason: 'a re-cut' }),
    ).toEqual([
      'luhn.v3: elsewhere does not descend from @evanion/luhn@3.0.0',
      'luhn.v3: elsewhere is not on main',
    ]);
  });

  /**
   * The dry run measures from the newest tag, so at a commit past 3.0.0 it
   * computes no change and cannot tell that 2.0.1 is not what it documents.
   */
  it("refuses a superseded line pinned past a later release's tag", () => {
    expect(
      faults({ ...release, sha: 'tag000' }, () => null, {
        v2: {
          version: '2.0.1',
          tag: '@evanion/luhn@2.0.1',
          sha: 'docs001',
          reason: 'a re-cut',
        },
      }),
    ).toEqual([
      'luhn.v2: docs001 carries @evanion/luhn@3.0.0, a later release than 2.0.1',
    ]);
  });

  /**
   * The generator applies a pin to the x.y.0 its line is cut from, so after
   * 3.1.0 a pin for 3.0.0 is read by nothing. `cut-releases.mjs` drops it, and
   * this refuses it when a person writes it back.
   */
  it('refuses a pin for an x.y.0 a later x.y.0 in its line replaced', () => {
    expect(
      faults({ ...release, next: true, reason: 'no pages' }, () => null, {}, [
        '@evanion/luhn@3.1.0',
      ]),
    ).toEqual([
      'luhn.v3: the site cuts v3 from 3.1.0 and reads no pin for 3.0.0',
    ]);
  });

  /** 3.0.1 is documented by 3.0.0, so the site still reads 3.0.0's pin. */
  it('passes a pin through a patch release of it', () => {
    expect(
      faults({ ...release, next: true, reason: 'no pages' }, () => null, {}, [
        '@evanion/luhn@3.0.1',
      ]),
    ).toEqual([]);
  });

  it('refuses a pin for a patch release', () => {
    expect(
      faults(
        { version: '3.0.1', tag: '@evanion/luhn@3.0.1', sha: 'head003' },
        () => null,
        {},
        ['@evanion/luhn@3.0.1'],
      ),
    ).toEqual([
      'luhn.v3: the site cuts v3 from 3.0.0 and reads no pin for 3.0.1',
    ]);
  });

  /**
   * A documentation fix after 3.0.1 is a re-cut of 3.0.0, from a commit that
   * carries the patch's tag.
   */
  it('passes a pinned commit past a patch of its release', () => {
    expect(
      faults(
        { ...release, sha: 'head003', reason: 'a re-cut' },
        () => null,
        {},
        ['@evanion/luhn@3.0.1'],
      ),
    ).toEqual([]);
  });

  /** npm's `latest` never moves to a prerelease, so no line holds one. */
  it('passes a pin whose line has only a later prerelease', () => {
    expect(
      faults({ ...release, sha: 'tag000' }, () => null, {}, [
        '@evanion/luhn@3.0.1-beta.0',
      ]),
    ).toEqual([]);
  });

  it('refuses a pin for a line the site no longer keeps', () => {
    expect(
      faults({ ...release, sha: 'tag000' }, () => null, {}, [
        '@evanion/luhn@4.0.0',
        '@evanion/luhn@5.0.0',
      ]),
    ).toEqual(['luhn.v3: the site keeps v5 and v4 and reads no pin for v3']);
  });

  it('refuses a pin for a workshop package', () => {
    expect(
      pinFaults({
        pins: { luhn: { v3: { ...release, sha: 'tag000' } } },
        packages: [{ name: '@evanion/luhn', slug: 'luhn', workshop: true }],
        commit: (ref) => refs[ref] ?? null,
        isAncestor: () => true,
        main: 'head003',
        dryRunAt: () => null,
        segmentOf: () => 'v3',
        taggedPast: () => [],
        releaseLines: () => [],
      }),
    ).toEqual([
      'luhn: @evanion/luhn is private, so npm has no release of it to document',
    ]);
  });

  it('refuses a release that never happened', () => {
    expect(
      faults({ version: '3.1.0', tag: '@evanion/luhn@3.1.0', sha: 'tag000' }),
    ).toEqual([
      'luhn.v3: @evanion/luhn@3.1.0 was never released, the repository has no such tag',
    ]);
  });

  it('refuses a release filed under another line', () => {
    expect(
      faults({ version: '2.0.1', tag: '@evanion/luhn@2.0.1', sha: 'tag000' }),
    ).toContain('luhn.v3: 2.0.1 is in the line v2, not v3');
  });

  it('refuses a release served from /next/ with no reason', () => {
    expect(faults({ ...release, next: true })).toEqual([
      'luhn.v3: is served from /next/ and gives no reason',
    ]);
  });

  /** A copied justification is one nobody wrote. */
  it('refuses two pins giving one reason', () => {
    expect(
      faults({ ...release, next: true, reason: 'no pages' }, () => null, {
        v2: {
          version: '2.0.1',
          tag: '@evanion/luhn@2.0.1',
          next: true,
          reason: 'no pages',
        },
      }),
    ).toContain('luhn.v2: gives the same reason as luhn.v3');
  });
});
