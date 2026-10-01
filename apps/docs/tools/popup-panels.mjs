/**
 * Every Twoslash hover popup on an MDX page carried as one HTML string instead
 * of an element tree.
 *
 * A popup is the hover's type, highlighted token by token, and its docblock,
 * rendered from Markdown: twenty-odd elements, written into every token that
 * carries a hover, and a page of reference entries carries thousands. Turbopack
 * holds every element of every page's compiled MDX while it builds, and its
 * peak grows with that element count rather than with the bytes: with the same
 * popups as one string each, `next build` for the docs site peaks at about 4 GB
 * on a GitHub runner, and at about 10.5 GB with the element trees.
 * wevm/vocs#466 made the same change for the same reason
 * (https://github.com/wevm/vocs/pull/466).
 *
 * Nextra's renderer writes each popup as a `PopupPanel` element, and
 * `rehypeTwoslashPopup` later renames that tag to `Popup.Panel` imported from
 * `nextra/components` (`nextra/dist/server/rehype-plugins/rehype-twoslash-popup.js`).
 * This replaces the panel with a `TwoslashPanel` element carrying the panel's
 * class and its contents as `html`, which that plugin leaves alone, so MDX
 * resolves it through `mdx-components.js` to `components/TwoslashPanel.tsx`,
 * under the lower-case name `rehype-pretty-code` leaves on it.
 * It runs in Shiki's `root` hook, which runs after every transformer's `code`
 * hook, and Twoslash builds the popups in its `code` hook. `TwoslashPanel`
 * turns the string back into elements while the page renders, after Turbopack
 * is done with the module.
 *
 * The contents are sanitized before they become a string, so the page renders
 * nothing the schema does not allow. A hover's docblock comes from whatever
 * declaration the token resolves to, a third-party `.d.ts` included, and a
 * Markdown link in it becomes an
 * `<a href>` whatever its protocol. `hast-util-sanitize`'s GitHub schema keeps
 * the elements and the link protocols a rendered README may carry and drops the
 * rest, `javascript:` included; the schema here adds the classes and the inline
 * styles Shiki writes on the highlighted tokens.
 */
import { defaultSchema, sanitize } from 'hast-util-sanitize';
import { hastToHtml } from 'shiki';

/**
 * The GitHub schema with any class allowed on any element, in place of the
 * few values it allows on `code`, `li` and the like, and with inline styles on
 * the two elements Shiki writes them on.
 */
const SCHEMA = (() => {
  const isClassName = (entry) =>
    (Array.isArray(entry) ? entry[0] : entry) === 'className';
  const attributes = Object.fromEntries(
    Object.entries(defaultSchema.attributes ?? {}).map(([tag, allowed]) => [
      tag,
      allowed.filter((entry) => !isClassName(entry)),
    ]),
  );
  attributes['*'] = [...(attributes['*'] ?? []), 'className'];
  attributes.span = [...(attributes.span ?? []), 'style'];
  attributes.pre = [...(attributes.pre ?? []), 'style'];
  return { ...defaultSchema, attributes };
})();

/** The element Nextra's Twoslash renderer writes for a popup's panel. */
const isPanel = (node) =>
  node.type === 'element' && node.tagName.toLowerCase() === 'popuppanel';

/**
 * A tree with every `class` property moved to `className`, the name hast
 * defines. Shiki and its Twoslash renderer write `class`, which
 * `hast-util-to-html` prints and `hast-util-sanitize` drops as unknown.
 */
function withClassNames(node) {
  if (node.type !== 'element') return node;
  const { class: held, ...properties } = node.properties ?? {};
  if (held !== undefined)
    properties.className = [
      ...(properties.className ?? []),
      ...String(held).split(/\s+/).filter(Boolean),
    ];
  return {
    ...node,
    properties,
    children: (node.children ?? []).map(withClassNames),
  };
}

/**
 * What `rehype-pretty-code` and Nextra do to every highlighted line, done to
 * the lines of a code block inside a popup, which leaves the tree before they
 * run. `rehype-pretty-code` takes the `line` class off every element whose
 * first class it is (`replaceLineClass` in its `dist/index.js`), and Nextra's
 * `onVisitLine` gives an empty line a space so it keeps its height
 * (`DEFAULT_REHYPE_PRETTY_CODE_OPTIONS` in `nextra/dist/server/rehype-plugins/rehype.js`).
 */
function asVisitedLines(node) {
  if (node.type !== 'element') return node;
  const children = (node.children ?? []).map(asVisitedLines);
  const [first, ...rest] = node.properties.className ?? [];
  if (first !== 'line') return { ...node, children };
  return {
    ...node,
    properties: {
      ...node.properties,
      className: rest.length ? rest : undefined,
    },
    children: children.length ? children : [{ type: 'text', value: ' ' }],
  };
}

/** A panel's contents, sanitized, as the HTML string `TwoslashPanel` renders. */
export function panelHtml(children) {
  return hastToHtml(
    sanitize(
      {
        type: 'root',
        children: children.map(withClassNames).map(asVisitedLines),
      },
      SCHEMA,
    ),
  );
}

function replace(node) {
  for (const [at, child] of (node.children ?? []).entries()) {
    if (isPanel(child)) {
      node.children[at] = {
        type: 'element',
        tagName: 'TwoslashPanel',
        properties: {
          className: withClassNames(child).properties.className,
          html: panelHtml(child.children),
        },
        children: [],
      };
    } else replace(child);
  }
}

/** The Shiki transformer that replaces every popup panel in a block. */
export function popupPanels() {
  return {
    name: '@evanion/docs:popup-panels',
    root(tree) {
      replace(tree);
    },
  };
}
