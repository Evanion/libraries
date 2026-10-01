import { describe, expect, it } from 'vitest';

import {
  anchorFences,
  freezeCatalogues,
  relativeLinks,
  resolveComponents,
  surfaceFaults,
} from './cut.mjs';

const RELEASE = 'd618051d725fb1c757969c41361d128396d3a697';
const OTHER = '8e0c6cb3bc7bc84e7a01debd4f059ae59687d2c4';

/**
 * The invariant: a cut page carries nothing the site would resolve against
 * `main`, and a page that does is refused when it is cut.
 *
 * The steps one at a time. `archives.test.mjs` drives them together through
 * the generator against a fixture repository.
 */

const context = {
  private: false,
  live: '/next/acl/getting-started/',
  provenance: { package: '@evanion/acl', version: '0.1.0', sha: 'd618051' },
  probe: () => {
    throw new Error('no probe on this page');
  },
};

describe('a cut page', () => {
  it('may carry the design system, the page sheet and HTML elements', () => {
    expect(
      surfaceFaults(
        [
          '# Title',
          '',
          '<Panel heading="A">',
          '<Text size="sm">Prose.</Text>',
          '</Panel>',
          '',
          "<PageSheet read={3} requires={[['Start', '../getting-started']]} />",
          '',
          '<details><summary>More</summary>Detail.</details>',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('may not carry an element outside the list', () => {
    expect(surfaceFaults('# Title\n\n<BehaviourCatalogue />\n')).toEqual([
      '<BehaviourCatalogue> is not an element a cut page may carry',
    ]);
  });

  it('may not import anything', () => {
    expect(
      surfaceFaults("import { Luhn } from '@evanion/luhn';\n\n# Title\n"),
    ).toEqual(["imports or exports: import { Luhn } from '@evanion/luhn';"]);
  });

  it('may not keep a fence the build would fill or compile', () => {
    expect(
      surfaceFaults(
        '# Title\n\n```ts file=libs/acl/README.md region=a\n```\n\n```ts twoslash\nx\n```\n',
      ),
    ).toEqual([
      'a fence still names a region: ts file=libs/acl/README.md region=a',
      'a fence compiles against main: ts twoslash',
    ]);
  });

  it('may keep a compiled fence anchored to the release it documents', () => {
    const fence = (sha) =>
      [
        '```ts twoslash',
        `// @filename: node_modules/.cache/docs-archives/0123456789abcdef-${sha}/index.ts`,
        '// ---cut---',
        'const x = 1;',
        '```',
      ].join('\n');
    const notice = '<ArchiveNotice kind="current" sha="d618051" />';

    expect(
      surfaceFaults(`# Title\n\n${notice}\n\n${fence(RELEASE)}\n`),
    ).toEqual([]);
    expect(surfaceFaults(`# Title\n\n${notice}\n\n${fence(OTHER)}\n`)).toEqual([
      "a fence compiles against 8e0c6cb, not the release's d618051: ts twoslash",
    ]);
  });

  it('may not keep a reference directive', () => {
    expect(
      surfaceFaults('# Title\n\n<!-- reference @evanion/acl#policy -->\n'),
    ).toContain('a reference directive was not expanded');
  });
});

describe('the workshop notice on a cut page', () => {
  const page = '# Title\n\n<WorkshopNotice slug="acl" />\n\nProse.\n';

  it('is dropped when the package was published at the release', () => {
    expect(resolveComponents(page, context)).toBe('# Title\n\n\n\nProse.\n');
  });

  it('becomes the statement it made when the package was private', () => {
    const resolved = resolveComponents(page, { ...context, private: true });

    expect(resolved).toContain('<Panel heading="Not on npm yet">');
    expect(resolved).toContain('`npm install @evanion/acl` did not resolve');
    expect(surfaceFaults(resolved)).toEqual([]);
  });
});

describe('a Twoslash fence on a cut page', () => {
  const root = {
    root: '/workspace/apps/docs/node_modules/.cache/docs-archives/g-sha',
    anchor: 'node_modules/.cache/docs-archives/g-sha',
  };

  it('keeps every directive and opens on the release it compiles against', () => {
    const asked = [];
    const fence = [
      '```ts twoslash',
      "import { policy } from '@evanion/acl';",
      "import { expectAccess } from '@evanion/acl/testing';",
      '// ---cut---',
      '// @errors: 2322',
      'const access = policy();',
      '//    ^?',
      '```',
    ];

    expect(
      anchorFences(fence.join('\n'), 'asking.mdx', (names) => {
        asked.push(names);
        return root;
      }),
    ).toBe(
      [
        fence[0],
        `// @filename: ${root.anchor}/index.ts`,
        '// ---cut---',
        ...fence.slice(1),
      ].join('\n'),
    );
    expect(asked).toEqual([['@evanion/acl']]);
  });

  it('compiles a tsx fence as tsx, at its own indent', () => {
    expect(
      anchorFences('  ```tsx twoslash\n  <a />\n  ```', 'x.mdx', () => root),
    ).toBe(
      `  \`\`\`tsx twoslash\n  // @filename: ${root.anchor}/index.tsx\n  // ---cut---\n  <a />\n  \`\`\``,
    );
  });

  it('leaves a fence the build does not compile alone', () => {
    const page =
      '```ts\n// ---cut---\nconst x = 1;\n```\n\n```js twoslash\nx;\n```';

    expect(
      anchorFences(page, 'x.mdx', () => {
        throw new Error('nothing to materialise');
      }),
    ).toBe(page);
  });

  it('refuses a fence that names its own files', () => {
    expect(() =>
      anchorFences(
        '# T\n\n```ts twoslash\n// @filename: a.ts\nx;\n```',
        'x.mdx',
        () => root,
      ),
    ).toThrow('x.mdx:3: the fence names its own files with // @filename');
  });
});

describe('the behaviour catalogue on a cut page', () => {
  it('is the list of sentences the release stated', () => {
    expect(
      freezeCatalogues(
        [
          '<p className="docs-api-entry__states-count"><Figure>2</Figure> behaviours</p>',
          `<BehaviourCatalogue library="acl" name="policy" groups={${JSON.stringify(
            [
              {
                label: 'policy',
                rows: [
                  { title: 'builds a document', id: 1 },
                  { title: 'refuses a {key}', id: 2 },
                ],
              },
            ],
          )}} />`,
        ].join('\n'),
      ),
    ).toBe(
      [
        '<p className="docs-api-entry__states-count">2 behaviours</p>',
        '- policy',
        '  - builds a document',
        '  - refuses a \\{key\\}',
      ].join('\n'),
    );
  });
});

describe('a link on a cut page', () => {
  it('stays inside the version when it names the section', () => {
    expect(
      relativeLinks(
        '[A](/widget/api#x) [B](/widget) [C](/urn/api)',
        'widget',
        'getting-started',
      ),
    ).toBe('[A](../api#x) [B](../) [C](/urn/api)');
  });

  it('is resolved from the index as the section root', () => {
    expect(relativeLinks('[A](/widget/api)', 'widget', 'index')).toBe(
      '[A](./api)',
    );
  });

  it('is left alone inside a fence', () => {
    const fence = "```ts\nfetch('/widget/api');\n```";

    expect(relativeLinks(fence, 'widget', 'index')).toBe(fence);
  });
});
