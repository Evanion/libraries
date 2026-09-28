import { describe, expect, it } from 'vitest';

import {
  freezeCatalogues,
  plainFences,
  relativeLinks,
  resolveComponents,
  surfaceFaults,
} from './cut.mjs';

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
      'a fence still compiles: ts twoslash',
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
  it('keeps what the reader saw and drops what the compiler read', () => {
    expect(
      plainFences(
        [
          '```ts twoslash',
          "import { policy } from '@evanion/acl';",
          '// ---cut---',
          '// @noErrors',
          'const access = policy();',
          '// ---cut-start---',
          'declare const hidden: 1;',
          '// ---cut-end---',
          'access.can();',
          '//     ^?',
          '```',
        ].join('\n'),
      ),
    ).toBe('```ts\nconst access = policy();\naccess.can();\n```');
  });

  it('leaves a plain fence alone', () => {
    const fence = '```ts\n// ---cut---\nconst x = 1;\n```';

    expect(plainFences(fence)).toBe(fence);
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
