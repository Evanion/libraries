import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { gitAt, parsePins, plan, writeArchives } from './archives.mjs';
import { dryRunVersion, seedPin } from './seed.mjs';

/**
 * The invariant: each version directory holds what its release shipped, cut
 * from the commit the pin file names or from the release's own tag, and a
 * release that shipped no pages is served from `main` under a notice.
 *
 * Asserted against fixture repositories rather than this one, whose tags and
 * pins change with every release, so a test written against it asserts the
 * date.
 */

const fixtures = [];

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

/**
 * A repository built one commit per step: each step writes its files, commits,
 * and tags the commit with the tag or tags it names.
 */
function repository(steps) {
  const root = mkdtempSync(join(tmpdir(), 'docs-archives-'));
  fixtures.push(root);

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });

  git('init', '--initial-branch=main');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');

  for (const [index, step] of steps.entries()) {
    for (const [path, contents] of Object.entries(step.files ?? {})) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), contents);
    }
    for (const path of step.remove ?? [])
      rmSync(join(root, path), { recursive: true, force: true });
    git('add', '-A');
    git('commit', '--allow-empty', '-m', `step ${index}`);
    for (const tag of [step.tag ?? []].flat()) git('tag', tag);
  }

  return root;
}

const luhn = [
  { name: '@evanion/luhn', slug: 'luhn', documented: true, workshop: false },
];

const readme = (value) =>
  [
    '# luhn',
    '',
    '<!-- #region generate -->',
    '```ts',
    `Luhn.generate('gloomhaven'); // -> '${value}'`,
    '```',
    '<!-- #endregion generate -->',
    '',
  ].join('\n');

const page = (body) => ['# Luhn', '', body, ''].join('\n');

function content(root) {
  return (path) => readFileSync(join(root, 'apps/docs/content', path), 'utf8');
}

describe('the plan for a package', () => {
  it('cuts the newest release from its own tag when the tag carries pages', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(plan({ packages: luhn, git: gitAt(root), pins: {} })).toMatchObject([
      {
        slug: 'luhn',
        current: {
          version: '3.0.0',
          segment: 'v3',
          from: 'cut',
          source: 'tag',
          dir: 'apps/docs/content/next/luhn',
        },
        lines: [],
      },
    ]);
  });

  it('reads a section at the path it had before content/next/ existed', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(
      plan({ packages: luhn, git: gitAt(root), pins: {} })[0].current,
    ).toMatchObject({ from: 'cut', dir: 'apps/docs/content/luhn' });
  });

  it('serves main under a notice when the release carries no pages', () => {
    const root = repository([
      { files: { 'libs/luhn/index.ts': '' }, tag: '@evanion/luhn@3.0.0' },
    ]);

    expect(
      plan({ packages: luhn, git: gitAt(root), pins: {} })[0].current,
    ).toMatchObject({ from: 'next', version: '3.0.0' });
  });

  it('serves a workshop package as unreleased when a release run has tagged it', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(
      plan({
        packages: [{ ...luhn[0], workshop: true }],
        git: gitAt(root),
        pins: {},
      })[0],
    ).toMatchObject({
      current: { version: null, from: 'next' },
      lines: [],
    });
  });

  /** Retention is the current line plus one, and a line of nothing is none. */
  it('keeps the line before the current one when it carries pages', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/luhn/index.mdx': page('One.') },
        tag: '@evanion/luhn@1.0.0',
      },
      {
        files: { 'apps/docs/content/luhn/index.mdx': page('Two.') },
        tag: '@evanion/luhn@2.0.1',
      },
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    const [section] = plan({ packages: luhn, git: gitAt(root), pins: {} });

    expect(section.lines.map((line) => [line.segment, line.version])).toEqual([
      ['v2', '2.0.1'],
    ]);
  });

  /** Below 1.0.0 the minor is the breaking bump, so the minor is the line. */
  it('files 0.x releases by their minor', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/luhn/index.mdx': page('One.') },
        tag: '@evanion/luhn@0.1.0',
      },
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Two.') },
        tag: '@evanion/luhn@0.2.0',
      },
    ]);

    const [section] = plan({ packages: luhn, git: gitAt(root), pins: {} });

    expect(section.current.segment).toBe('v0.2');
    expect(section.lines.map((line) => line.segment)).toEqual(['v0.1']);
  });

  it('cuts a pinned release from the pinned commit and path', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/widget/index.mdx': page('Old home.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);
    const sha = gitAt(root).commit('HEAD');

    const [section] = plan({
      packages: luhn,
      git: gitAt(root),
      pins: {
        luhn: {
          v3: {
            version: '3.0.0',
            tag: '@evanion/luhn@3.0.0',
            sha,
            path: 'apps/docs/content/widget',
            reason: 'the section lived under another name',
          },
        },
      },
    });

    expect(section.current).toMatchObject({
      from: 'cut',
      sha,
      dir: 'apps/docs/content/widget',
      source: 'tag',
    });
  });

  it('refuses a pin naming a commit the repository does not have', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(() =>
      plan({
        packages: luhn,
        git: gitAt(root),
        pins: {
          luhn: {
            v3: {
              version: '3.0.0',
              tag: '@evanion/luhn@3.0.0',
              sha: '0123456789abcdef0123456789abcdef01234567',
              reason: 'a re-cut',
            },
          },
        },
      }),
    ).toThrow(/not a commit in this repository/);
  });

  /**
   * A shallow clone has no tags, and cutting from one would serve `main` at
   * every bare path without a word. The pin file names tags, so it is what
   * notices.
   */
  it('refuses a checkout that has no tag a pin names', () => {
    const root = repository([
      { files: { 'apps/docs/content/next/luhn/index.mdx': page('Draft.') } },
    ]);

    expect(() =>
      plan({
        packages: luhn,
        git: gitAt(root),
        pins: {
          luhn: {
            v3: {
              version: '3.0.0',
              tag: '@evanion/luhn@3.0.0',
              next: true,
              reason: 'no pages',
            },
          },
        },
      }),
    ).toThrow(/pins @evanion\/luhn@3\.0\.0, which this checkout has no tag/);
  });

  /**
   * A pin names the release it was made for. A later release in the same line
   * is cut from its own tag until somebody pins it, so a re-cut of 3.0.0 never
   * silently becomes the documentation of 3.0.1.
   */
  it('cuts a newer release in a pinned line from its own tag', () => {
    const root = repository([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three one.') },
        tag: '@evanion/luhn@3.0.1',
      },
    ]);
    const git = gitAt(root);

    const [section] = plan({
      packages: luhn,
      git,
      pins: {
        luhn: {
          v3: { version: '3.0.0', tag: '@evanion/luhn@3.0.0', next: true },
        },
      },
    });

    expect(section.current).toMatchObject({
      version: '3.0.1',
      from: 'cut',
      sha: git.commit('@evanion/luhn@3.0.1'),
    });
  });

  it('serves a package with no release from main', () => {
    const root = repository([
      { files: { 'apps/docs/content/next/luhn/index.mdx': page('Draft.') } },
    ]);

    expect(
      plan({ packages: luhn, git: gitAt(root), pins: {} })[0].current,
    ).toMatchObject({ version: null, from: 'next' });
  });
});

describe('the pin file', () => {
  const pin = { version: '3.0.0', tag: '@evanion/luhn@3.0.0' };

  it('reads a pin to a commit and a pin to /next/', () => {
    expect(
      parsePins(
        JSON.stringify({
          luhn: {
            v3: { ...pin, next: true, reason: 'not seeded' },
            v2: { ...pin, sha: 'a1b2c3d' },
          },
        }),
      ),
    ).toMatchObject({ luhn: { v3: { next: true }, v2: { sha: 'a1b2c3d' } } });
  });

  it('refuses a pin with no commit that is not served from /next/', () => {
    expect(() => parsePins(JSON.stringify({ luhn: { v3: pin } }))).toThrow(
      /pins no commit/,
    );
  });

  it('refuses an empty reason', () => {
    expect(() =>
      parsePins(
        JSON.stringify({
          luhn: { v3: { ...pin, sha: 'a1b2c3d', reason: ' ' } },
        }),
      ),
    ).toThrow(/empty reason/);
  });
});

describe('the seed question', () => {
  const release = {
    name: '@evanion/luhn',
    tag: '@evanion/luhn@3.0.0',
    version: '3.0.0',
    main: 'f00dfeed',
    dependencies: () => [],
  };

  it('seeds when the dry run computes no change', () => {
    expect(seedPin({ ...release, computed: () => null })).toEqual({
      version: '3.0.0',
      tag: '@evanion/luhn@3.0.0',
      sha: 'f00dfeed',
      reason: 'seed: nx release version --dry-run computes 3.0.0 at this SHA',
    });
  });

  it('does not seed a package nx release would bump', () => {
    expect(seedPin({ ...release, computed: () => '3.0.1' })).toMatchObject({
      next: true,
      reason: expect.stringMatching(/^not seeded: .*computes 3\.0\.1/),
    });
  });

  /** `updateDependents: "always"` bumps a package whose dependency bumps. */
  it('does not seed a package whose workspace dependency would bump', () => {
    expect(
      seedPin({
        ...release,
        name: '@evanion/token',
        dependencies: (name) =>
          name === '@evanion/token' ? ['@evanion/luhn'] : [],
        computed: (name) => (name === '@evanion/luhn' ? '3.0.1' : null),
      }),
    ).toMatchObject({
      next: true,
      reason: expect.stringContaining('@evanion/luhn computes 3.0.1'),
    });
  });

  it('reads the version a dry run computes', () => {
    expect(
      dryRunVersion(
        '@evanion/luhn ❓ Applied semver relative bump "patch", derived from conventional commits data, to get new version 3.0.1\n',
        '@evanion/luhn',
      ),
    ).toBe('3.0.1');
    expect(
      dryRunVersion(
        '@evanion/luhn 🚫 No changes were detected using git history and the conventional commits standard\n',
        '@evanion/luhn',
      ),
    ).toBeNull();
  });

  it('refuses a dry run that says nothing about the package', () => {
    expect(() => dryRunVersion('', '@evanion/luhn')).toThrow(/printed nothing/);
  });
});

describe('the directories the generator writes', () => {
  function generated(steps, pins) {
    const root = repository(steps);
    if (pins)
      writeFileSync(
        join(root, 'apps/docs/archives.json'),
        JSON.stringify(pins),
      );
    mkdirSync(join(root, 'apps/docs/content/next/luhn'), { recursive: true });

    const manifest = writeArchives({
      docsRoot: join(root, 'apps/docs'),
      workspaceRoot: root,
      packages: luhn,
    });

    return { root, manifest, read: content(root) };
  }

  /**
   * The README changes its claim after the tag, so a cut that read the README
   * on disk rather than at the tag would show the new value.
   */
  it('fills a region from the README as it was at the tag', () => {
    const { read } = generated([
      {
        files: {
          'libs/luhn/README.md': readme('Q'),
          'apps/docs/content/next/luhn/index.mdx': page(
            '```ts file=libs/luhn/README.md region=generate\n```',
          ),
        },
        tag: '@evanion/luhn@3.0.0',
      },
      { files: { 'libs/luhn/README.md': readme('Z') } },
    ]);

    const cut = read('luhn/index.mdx');

    expect(cut).toContain("Luhn.generate('gloomhaven'); // -> 'Q'");
    expect(cut).not.toContain('region=');
  });

  it('writes the notice naming the release and the commit under the title', () => {
    const { root, read } = generated([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);
    const sha = gitAt(root).commit('@evanion/luhn@3.0.0').slice(0, 7);

    expect(read('luhn/index.mdx').split('\n').slice(0, 3)).toEqual([
      '# Luhn',
      '',
      `<ArchiveNotice kind="current" source="tag" package="@evanion/luhn" version="3.0.0" sha="${sha}" />`,
    ]);
  });

  it('turns a Twoslash fence into the plain code a reader saw', () => {
    const { read } = generated([
      {
        files: {
          'apps/docs/content/next/luhn/index.mdx': page(
            [
              '```ts twoslash',
              "import { Luhn } from '@evanion/luhn';",
              '// ---cut---',
              "const check = Luhn.generate('gloomhaven');",
              '//    ^?',
              '```',
            ].join('\n'),
          ),
        },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(read('luhn/index.mdx')).toContain(
      "```ts\nconst check = Luhn.generate('gloomhaven');\n```",
    );
  });

  it('links a page of its own section relatively, from before the links were', () => {
    const { read } = generated([
      {
        files: {
          'apps/docs/content/luhn/index.mdx': page('[Usage](/luhn/usage).'),
          'apps/docs/content/luhn/usage.mdx': page(
            '[Home](/luhn) and [URN](/urn/api).',
          ),
        },
        tag: '@evanion/luhn@1.0.0',
      },
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Two.') },
        tag: '@evanion/luhn@2.0.0',
      },
    ]);

    expect(read('luhn/v1/index.mdx')).toContain('[Usage](./usage)');
    expect(read('luhn/v1/usage.mdx')).toContain(
      '[Home](../) and [URN](/urn/api)',
    );
  });

  it('replaces a live example with a link to the same page under /next/', () => {
    const { read } = generated([
      {
        files: {
          'apps/docs/content/next/luhn/index.mdx': page('<LuhnSpecimen />'),
        },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(read('luhn/index.mdx')).toContain('](/next/luhn/)');
    expect(read('luhn/index.mdx')).not.toContain('<LuhnSpecimen');
  });

  it('freezes a probe into the call and the value its README stated', () => {
    const { read } = generated([
      {
        files: {
          'libs/luhn/README.md': readme('Q'),
          'apps/docs/components/probes/luhn.ts': [
            'export const generate: Probe = {',
            "  label: 'phrase',",
            "  hint: 'Retype it.',",
            '  call: (phrase) => Luhn.generate(phrase),',
            '  source: (phrase) => `Luhn.generate(${quote(phrase)})`,',
            "  region: { file: 'libs/luhn/README.md', name: 'generate' },",
            '};',
          ].join('\n'),
          'apps/docs/content/next/luhn/index.mdx': page(
            '<Probe package="luhn" probe="generate" />',
          ),
        },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(read('luhn/index.mdx')).toMatch(
      /<FrozenProbe label="phrase" input="gloomhaven" call="Luhn\.generate\('gloomhaven'\)" value="'Q'" package="@evanion\/luhn" version="3\.0\.0" sha="[0-9a-f]{7}" live="\/next\/luhn\/" \/>/,
    );
  });

  it('refuses to cut a page that mounts an element outside the list', () => {
    expect(() =>
      generated([
        {
          files: {
            'apps/docs/content/next/luhn/index.mdx': page('<Tabulated />'),
          },
          tag: '@evanion/luhn@3.0.0',
        },
      ]),
    ).toThrow(/<Tabulated> is not an element a cut page may carry/);
  });

  it('copies main under the notice when the release shipped no pages', () => {
    const { root, read } = generated([
      { files: { 'libs/luhn/index.ts': '' }, tag: '@evanion/luhn@3.0.0' },
    ]);
    writeFileSync(
      join(root, 'apps/docs/content/next/luhn/index.mdx'),
      page('Main.'),
    );
    writeArchives({
      docsRoot: join(root, 'apps/docs'),
      workspaceRoot: root,
      packages: luhn,
    });

    expect(read('luhn/index.mdx')).toContain(
      '<ArchiveNotice kind="next" package="@evanion/luhn" version="3.0.0" />',
    );
    expect(read('luhn/index.mdx')).toContain('Main.');
  });

  it('hides a release line from the section sidebar', () => {
    const { read } = generated([
      {
        files: { 'apps/docs/content/luhn/index.mdx': page('One.') },
        tag: '@evanion/luhn@1.0.0',
      },
      {
        files: {
          'apps/docs/content/next/luhn/index.mdx': page('Two.'),
          'apps/docs/content/next/luhn/_meta.ts':
            "export default { index: 'Luhn' };\n",
        },
        tag: '@evanion/luhn@2.0.0',
      },
    ]);

    expect(read('luhn/meta.cut.ts')).toBe(
      "export default { index: 'Luhn' };\n",
    );
    expect(read('luhn/_meta.ts')).toContain('"v1":{"display":"hidden"}');
  });

  it('cuts a directory again when its files are not the ones it wrote', () => {
    const { root, read } = generated([
      {
        files: {
          'apps/docs/content/next/luhn/index.mdx': page('Three.'),
          'apps/docs/content/next/luhn/api.mdx': page('Api.'),
        },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);
    const cut = join(root, 'apps/docs/content/luhn');
    const write = () =>
      writeArchives({
        docsRoot: join(root, 'apps/docs'),
        workspaceRoot: root,
        packages: luhn,
      });

    rmSync(join(cut, 'api.mdx'));
    writeFileSync(join(cut, 'index.mdx'), `${read('luhn/index.mdx')}Edited.\n`);
    write();

    expect(read('luhn/api.mdx')).toContain('Api.');
    expect(read('luhn/index.mdx')).not.toContain('Edited.');
  });

  it('records what it wrote for the site to read', () => {
    const { manifest, root } = generated([
      {
        files: { 'apps/docs/content/next/luhn/index.mdx': page('Three.') },
        tag: '@evanion/luhn@3.0.0',
      },
    ]);

    expect(manifest.sections.luhn.current).toMatchObject({
      version: '3.0.0',
      pages: [''],
    });
    expect(existsSync(join(root, 'apps/docs/content/versions.json'))).toBe(
      true,
    );
  });
});

/**
 * A reference page's entries carry the sentences the release's own suite
 * stated, read from the tree at the pinned commit. The loader fails a page whose
 * package has no behaviour data, so each case here fails when a cut reference
 * page has none.
 */
describe('the reference pages the generator cuts', () => {
  /** A package at `dir` exporting `name`, whose suite states `sentence`. */
  const library = (dir, packageName, name, sentence) => ({
    [`${dir}/package.json`]: JSON.stringify({
      name: packageName,
      type: 'module',
      exports: {
        './package.json': './package.json',
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      },
    }),
    [`${dir}/README.md`]: `# ${packageName}\n`,
    [`${dir}/src/index.ts`]: `/** Makes one. */\nexport function ${name}(): string {\n  return '';\n}\n`,
    [`${dir}/src/index.test.ts`]: [
      "import { describe, it } from 'vitest';",
      `import { ${name} } from './index.js';`,
      '',
      `describe('${name}', () => {`,
      `  it('${sentence}', () => ${name}());`,
      '});',
      '',
    ].join('\n'),
  });

  /** A section of two pages, the second an entry for `name`. */
  const section = (slug, packageName, name) => ({
    [`apps/docs/content/next/${slug}/index.mdx`]: page('Overview.'),
    [`apps/docs/content/next/${slug}/api.mdx`]: [
      '# API reference',
      '',
      `## \`${name}\``,
      '',
      `<!-- reference ${packageName}#${name} -->`,
      '',
    ].join('\n'),
  });

  function cutAll(steps, packages) {
    const root = repository(steps);
    for (const { slug } of packages)
      mkdirSync(join(root, 'apps/docs/content/next', slug), {
        recursive: true,
      });

    writeArchives({
      docsRoot: join(root, 'apps/docs'),
      workspaceRoot: root,
      packages,
    });

    return content(root);
  }

  /**
   * A release run tags every package it versions on one commit, and each
   * package's section references its own package. The first section cut from
   * that commit cannot be the only one whose package is read.
   */
  it('states the behaviours of every package released on one commit', () => {
    const read = cutAll(
      [
        {
          files: {
            ...library('libs/luhn', '@evanion/luhn', 'createLuhn', 'checks'),
            ...library('libs/urn', '@evanion/urn', 'parseUrn', 'parses'),
            ...section('luhn', '@evanion/luhn', 'createLuhn'),
            ...section('urn', '@evanion/urn', 'parseUrn'),
          },
          tag: ['@evanion/luhn@3.0.1', '@evanion/urn@2.1.0'],
        },
      ],
      [
        ...luhn,
        {
          name: '@evanion/urn',
          slug: 'urn',
          documented: true,
          workshop: false,
        },
      ],
    );

    expect(read('luhn/api.mdx')).toContain('  - checks');
    expect(read('urn/api.mdx')).toContain('  - parses');
  });

  /**
   * The loader names a package's behaviour file after the directory the
   * package resolves to, and a package can have lived under another name:
   * `@evanion/nestjs-correlation-id` was at `nest/correlation-id`.
   */
  it('states the behaviours of a package whose directory had another name', () => {
    const read = cutAll(
      [
        {
          files: {
            ...library(
              'nest/correlation-id',
              '@evanion/nestjs-correlation-id',
              'correlate',
              'reads the header',
            ),
            ...section(
              'nestjs-correlation-id',
              '@evanion/nestjs-correlation-id',
              'correlate',
            ),
          },
          tag: '@evanion/nestjs-correlation-id@2.1.0',
        },
      ],
      [
        {
          name: '@evanion/nestjs-correlation-id',
          slug: 'nestjs-correlation-id',
          documented: true,
          workshop: false,
        },
      ],
    );

    expect(read('nestjs-correlation-id/api.mdx')).toContain(
      '  - reads the header',
    );
  });
});
