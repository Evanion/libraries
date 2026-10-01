import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import loader from './mdx-nextra-loader.mjs';
import { panelHtml } from './popup-panels.mjs';

const docsRoot = join(import.meta.dirname, '..');
const require = createRequire(join(docsRoot, 'package.json'));

/**
 * One MDX source compiled the way `next build` compiles a page: through
 * `mdx-nextra-loader.mjs` into Nextra's own loader, with the options Nextra
 * registers, Twoslash and all.
 */
function compile(source) {
  return new Promise((resolve, reject) => {
    loader.call(
      {
        getOptions: () => ({
          nextraLoader: join(
            dirname(require.resolve('nextra/package.json')),
            'loader.cjs',
          ),
          mdxOptions: { rehypePrettyCodeOptions: {} },
          search: { codeblocks: false },
          defaultShowCopyCode: true,
          latex: true,
          staticImage: true,
          contentDirBasePath: '/',
          whiteListTagsStyling: [],
        }),
        async: () => (error, value) => (error ? reject(error) : resolve(value)),
        resourcePath: join(docsRoot, 'content', 'popup-panels.test.mdx'),
        resourceQuery: '',
        // Turbopack's file watching, which a single compile has no use for.
        addContextDependency: () => undefined,
      },
      source,
    );
  });
}

const FENCE = [
  '```ts twoslash',
  '/**',
  ' * Read [the guide](javascript:alert(1)) or [the site](https://example.com).',
  ' */',
  'function guide(): void {}',
  'guide();',
  '```',
].join('\n');

describe('the popup panels', () => {
  /**
   * The shape the site depends on, from Nextra's real loader: the panel
   * `rehypeTwoslashPopup` would turn into `Popup.Panel` arrives as the
   * lower-case `twoslashpanel` MDX looks up on `mdx-components.js`, with its
   * contents as one string. A Nextra upgrade that renames the panel's tag or
   * runs the site's transformers before its own Twoslash transformer leaves
   * the element trees in place, and fails here.
   */
  it("replaces every popup panel in Nextra's output with one carrying its contents as a string", async () => {
    const out = await compile(FENCE);

    expect(out).toContain('<Popup className="twoslash-hover">');
    expect(out).not.toContain('Popup.Panel');
    expect(out).toMatch(
      /<_components\.twoslashpanel className="twoslash-popup-container" html="[^"]*twoslash-popup-code/,
    );
  });

  /**
   * The panels only: the fence's own source shows the docblock as code, and
   * the page carries that source as text, which is what it should carry.
   */
  it('keeps no javascript: link a docblock carries, through the real loader', async () => {
    const out = await compile(FENCE);
    const panels = [
      ...out.matchAll(/<_components\.twoslashpanel [^>]*html="([^"]*)"/g),
    ].map(([, html]) => html);

    expect(panels.join('')).toContain('href=&quot;https://example.com&quot;');
    expect(panels.join('')).toContain('the guide');
    expect(panels.join('')).not.toMatch(/javascript:/i);
  });

  it('gives a code block in a popup the lines rehype-pretty-code gives every other block', () => {
    const line = (children) => ({
      type: 'element',
      tagName: 'span',
      properties: { className: ['line'] },
      children,
    });
    const html = panelHtml([
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [line([{ type: 'text', value: 'a' }]), line([])],
          },
        ],
      },
    ]);

    expect(html).toBe('<pre><code><span>a</span><span> </span></code></pre>');
  });

  it('drops a javascript: href, a script and an event handler, and keeps the token classes', () => {
    const html = panelHtml([
      {
        type: 'element',
        tagName: 'code',
        properties: { class: 'twoslash-popup-code' },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { class: 'sh-1itgoe' },
            children: [{ type: 'text', value: 'function' }],
          },
        ],
      },
      {
        type: 'element',
        tagName: 'a',
        properties: { href: 'javascript:alert(1)', onClick: 'alert(2)' },
        children: [{ type: 'text', value: 'bad' }],
      },
      {
        type: 'element',
        tagName: 'script',
        properties: {},
        children: [{ type: 'text', value: 'alert(3)' }],
      },
    ]);

    expect(html).toContain(
      '<code class="twoslash-popup-code"><span class="sh-1itgoe">function</span></code>',
    );
    expect(html).not.toMatch(/javascript:|onclick|<script|alert\(3\)/i);
  });
});
