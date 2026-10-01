/**
 * The one set of classes every highlighted token on the site carries in place
 * of an inline `style`, and the stylesheet that gives them their colours.
 *
 * Shiki writes both themes' colours into every token as
 * `style="--shiki-light:…;--shiki-dark:…"`, and a page of Twoslash fences
 * carries tens of thousands of tokens, most of them inside hover popups. Each
 * one becomes a React style object in the page's server chunk and in its RSC
 * payload. The github themes colour code with about a dozen pairs, so a class
 * per pair carries the same colours in a fraction of the bytes.
 *
 * The classes are `transformerStyleToClass`'s own: its name for a style is a
 * hash of the style string, so every process that highlights -- each of
 * Turbopack's loader workers, and `behaviour-data.mjs` -- names a pair the same
 * way without sharing a registry. The stylesheet is every pair the two themes
 * can produce, registered through the same transformer, so it is complete
 * before any page is highlighted. A style outside it (a token with a font
 * style, which the github themes give only to markup scopes) keeps its inline
 * `style` and renders as before.
 */
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { transformerStyleToClass } from '@shikijs/transformers';
import { flatTokenVariants, normalizeTheme, stringifyTokenStyle } from 'shiki';

/** The two themes every fence on the site is highlighted against. */
export const THEMES = { light: 'github-light', dark: 'github-dark' };

const PREFIX = '--shiki-';

const order = Object.keys(THEMES);

/**
 * The themes, imported rather than loaded through `bundledThemes`, because this
 * module is reached from a loader Turbopack loads with `require()`, and
 * `require()` refuses a module graph with a top-level `await`.
 */
const themes = [githubLight, githubDark].map((theme) => normalizeTheme(theme));

for (const [at, key] of order.entries())
  if (themes[at].name !== THEMES[key])
    throw new Error(
      `code-classes imports ${themes[at].name} as ${THEMES[key]}`,
    );

/**
 * Every foreground a theme gives a token. `vscode-textmate`'s colour map
 * upper-cases each colour it registers, so a token's colour is upper case
 * whatever case the theme file spells it in.
 */
function foregrounds(theme) {
  return [
    ...new Set(
      [theme.fg, ...theme.settings.map((rule) => rule.settings?.foreground)]
        .filter(Boolean)
        .map((color) => color.toUpperCase()),
    ),
  ];
}

/**
 * Every style string Shiki writes for these themes with `defaultColor: false`:
 * one per pair of foregrounds, built by Shiki's own `flatTokenVariants`, and the
 * style it puts on a block's root, which also carries both backgrounds
 * (`codeToTokens` in `@shikijs/core`).
 */
function styles() {
  const [light, dark] = themes.map(foregrounds);
  const pairs = light.flatMap((l) =>
    dark.map((d) =>
      stringifyTokenStyle(
        flatTokenVariants(
          {
            content: '',
            offset: 0,
            variants: { [order[0]]: { color: l }, [order[1]]: { color: d } },
          },
          order,
          PREFIX,
          false,
        ).htmlStyle,
      ),
    ),
  );
  const root = [
    ...order.map((key, at) => `${PREFIX}${key}:${themes[at].fg}`),
    ...order.map((key, at) => `${PREFIX}${key}-bg:${themes[at].bg}`),
  ].join(';');
  return [...pairs, root];
}

/**
 * `sh-` in place of the default `__shiki_`, because the name is written once per
 * token on every page and in every catalogue case.
 */
const registry = transformerStyleToClass({ classPrefix: 'sh-' });

/** Each style string the stylesheet holds, and the class that stands for it. */
const classes = new Map(
  styles().map((style) => {
    const element = { type: 'element', properties: { style } };
    registry.pre.call(
      {
        addClassToHast: (node, name) => {
          node.properties.class = name;
        },
      },
      element,
    );
    return [style, element.properties.class];
  }),
);

/** The rules for every class in `classes`, as one stylesheet. */
export const stylesheet = `${registry.getCSS()}\n`;

function classesOf(node) {
  const held = node.properties.class ?? node.properties.className ?? [];
  return Array.isArray(held) ? held : String(held).split(/\s+/);
}

function swap(node) {
  if (node.type !== 'element') return;
  const style = node.properties.style;
  const name = typeof style === 'string' ? classes.get(style) : undefined;
  if (name) {
    delete node.properties.style;
    const held = classesOf(node).filter(Boolean);
    delete node.properties.className;
    node.properties.class = [...held, name].join(' ');
  }
  for (const child of node.children ?? []) swap(child);
}

/**
 * A Shiki transformer that moves every style the stylesheet holds into its
 * class, everywhere under the block's own `<pre>`.
 *
 * It works on the finished tree in `root` and not on tokens: Twoslash builds
 * each hover popup in its `code` hook by highlighting the type separately with
 * no transformers (`highlightPopupContent` in `@shikijs/twoslash`), so the
 * popups' tokens only exist, already styled, once every `code` hook has run.
 *
 * The `<pre>` keeps its inline style because `rehype-pretty-code` decides what
 * happens to it: with Nextra's `keepBackground: false` it deletes
 * `pre.properties.style`, and a class carrying the same backgrounds would
 * survive that and paint the block.
 */
export function codeClasses() {
  return {
    name: '@evanion/docs:code-classes',
    root(tree) {
      for (const block of tree.children)
        for (const child of block.children ?? []) swap(child);
    },
  };
}
