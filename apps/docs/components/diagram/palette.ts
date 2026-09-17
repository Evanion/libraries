import { text, type } from '@evanion/baize-ui/tokens';

/**
 * Mermaid's palette, expressed as the site's own custom properties.
 *
 * Mermaid bakes colours into the SVG it returns: the `<style>` block it writes
 * inside the document carries literal hex values, and `themeVariables` cannot be
 * handed `var(--baize-felt)` because khroma parses every variable to derive the
 * ones that were not supplied and throws on anything that is not a colour.
 *
 * So the render is given six sentinel colours -- values no design would ever
 * pick -- and the returned SVG string has each one replaced by the custom
 * property it stands for. What reaches the page is a diagram whose every colour
 * is `var(--baize-*)`, which means the light/dark toggle recolours it the way it
 * recolours a paragraph: by rebinding the property. Nothing re-renders, and the
 * diagram cannot hold a colour the rest of the page does not.
 */

/**
 * The six roles a diagram draws with, as colours chosen to be unmistakable in
 * the rendered string.
 *
 * Pure channel primaries rather than plausible values: the substitution is a
 * string replacement over generated CSS, and a sentinel that could also be a
 * colour Mermaid picked for its own reasons would make the replacement a guess.
 */
const sentinel = {
  page: '#ff0000',
  surface: '#00ff00',
  rule: '#0000ff',
  text: '#ffff00',
  muted: '#ff00ff',
  hue: '#00ffff',
} as const;

/**
 * What each sentinel becomes.
 *
 * `--baize-hue` is the one that is not a ground role: inside a `.docs-identity`
 * subtree it holds the section's categorical colour, so a diagram's accent is
 * the acl page's coral and the urn page's periwinkle without either page saying
 * so. Outside a section it falls back to the secondary text colour, which is
 * what the rest of the site does with an unbound hue.
 */
const property: Record<keyof typeof sentinel, string> = {
  page: 'var(--baize-ink)',
  surface: 'var(--baize-felt)',
  rule: 'var(--baize-rule)',
  text: 'var(--baize-chalk)',
  muted: 'var(--baize-lichen)',
  hue: 'var(--baize-hue, var(--baize-lichen))',
};

/**
 * A rem token as the px number Mermaid measures type with.
 *
 * `fontSize` is read back as a number by the layout passes -- node padding and
 * label boxes are computed from it -- so a rem string measures as zero and
 * collapses every box onto its text. The root font size is the browser default
 * the site does not change.
 */
function px(rem: string): string {
  return `${Number.parseFloat(rem) * 16}px`;
}

/**
 * Every theme variable Mermaid would otherwise derive for itself.
 *
 * Exhaustive on purpose. Mermaid fills an unsupplied variable by adjusting a
 * supplied one, and an adjusted sentinel is a colour that is neither a sentinel
 * nor a token -- it survives the substitution and lands on the page as a shade
 * of pure green. `diagram.test.ts` renders the site's own diagrams and fails on
 * any colour left over, which is what keeps this list honest as Mermaid changes.
 */
export const diagramThemeVariables = {
  darkMode: false,
  background: sentinel.page,

  primaryColor: sentinel.surface,
  primaryTextColor: sentinel.text,
  primaryBorderColor: sentinel.rule,
  secondaryColor: sentinel.surface,
  secondaryTextColor: sentinel.text,
  secondaryBorderColor: sentinel.rule,
  tertiaryColor: sentinel.page,
  tertiaryTextColor: sentinel.text,
  tertiaryBorderColor: sentinel.rule,

  mainBkg: sentinel.surface,
  nodeBorder: sentinel.rule,
  nodeTextColor: sentinel.text,
  clusterBkg: sentinel.page,
  clusterBorder: sentinel.rule,
  titleColor: sentinel.text,

  lineColor: sentinel.muted,
  defaultLinkColor: sentinel.muted,
  arrowheadColor: sentinel.muted,
  edgeLabelBackground: sentinel.page,
  labelBackground: sentinel.page,
  labelBoxBkgColor: sentinel.surface,
  labelBoxBorderColor: sentinel.rule,
  labelTextColor: sentinel.text,
  textColor: sentinel.text,

  noteBkgColor: sentinel.surface,
  noteTextColor: sentinel.text,
  noteBorderColor: sentinel.rule,
  errorBkgColor: sentinel.surface,
  errorTextColor: sentinel.text,

  fontFamily: type.text,
  fontSize: px(text.sm),
} as const;

/**
 * The rules that sit after Mermaid's own, inside the same `#id` scope.
 *
 * Mermaid scopes its generated stylesheet by the render id -- `#m1 .node rect`
 * -- which outranks anything `global.css` can say about a class. `themeCSS` is
 * appended inside that same scope, so it is the only place a rule can win
 * without `!important`.
 *
 * Two things live here. The accent, which is a node the author marked with
 * `:::accent` and is the one place a diagram spends a saturated colour. And the
 * shape of a node, which the tokens settle and Mermaid does not expose as a
 * variable.
 *
 * Every entry has to be a rule. Mermaid nests this inside `#id { … }` and runs
 * the result through stylis, which drops a bare declaration at the top of the
 * block along with the rule that follows it.
 */
export const diagramThemeCss = `
  .node > rect,
  .node > polygon,
  .node > circle,
  .node > path {
    rx: var(--baize-radius-button);
    ry: var(--baize-radius-button);
  }

  .cluster > rect {
    rx: var(--baize-radius-card);
    ry: var(--baize-radius-card);
    stroke-dasharray: 3 3;
  }

  .accent > rect,
  .accent > polygon,
  .accent > circle,
  .accent > path {
    stroke: ${sentinel.hue};
    stroke-width: 2px;
  }

  .accent .nodeLabel {
    color: ${sentinel.hue};
    font-weight: 600;
  }

  .edgeLabel .labelBkg {
    background-color: ${sentinel.page};
  }
`;

/**
 * Colours that survive a render without being a sentinel, and why each is inert.
 *
 * Mermaid writes one stylesheet covering every shape and `look` it can draw, so
 * the block carries rules for shapes the site's diagrams never use. These are
 * the values in those rules. `diagram.test.ts` asserts the leftovers are exactly
 * this set: a new one means Mermaid started colouring something we do render.
 */
export const INERT_COLOURS = [
  // `.node .katex path`, which only applies to a label written as LaTeX.
  '#000',
  // A `feDropShadow` in `<defs>` and `circle .state-start`, both reached only
  // by `look: neo` and the state diagram.
  '#000000',
  // The drop shadow under a `look: neo` node. Every rule carrying it is behind
  // `[data-look="neo"]`, and `Diagram.tsx` pins the look to `classic`.
  'rgba(185,185,185,1)',
] as const;

/** Every sentinel as the `r, g, b` triple Mermaid converts some of them to. */
const triples = Object.entries(sentinel).map(([role, hex]) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    role: role as keyof typeof sentinel,
    triple: [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff],
  };
});

/**
 * The rendered SVG with every sentinel replaced by the property it stands for.
 *
 * Two forms have to be handled. The hex, which is most of them, and the `rgba()`
 * Mermaid converts an edge label's background to so that it can carry an alpha.
 * A custom property cannot take an alpha the way a literal can, so that one
 * becomes a `color-mix` against transparent, which is the same result.
 */
export function bindPalette(svg: string): string {
  let bound = svg;

  for (const { role, triple } of triples) {
    const [red, green, blue] = triple;
    const rgba = new RegExp(
      `rgba?\\(\\s*${red}\\s*,\\s*${green}\\s*,\\s*${blue}\\s*(?:,\\s*([\\d.]+)\\s*)?\\)`,
      'g',
    );

    bound = bound.replace(rgba, (_match, alpha?: string) =>
      alpha === undefined || Number(alpha) === 1
        ? property[role]
        : `color-mix(in oklab, ${property[role]} ${Number(alpha) * 100}%, transparent)`,
    );
  }

  for (const [role, hex] of Object.entries(sentinel)) {
    bound = bound.replaceAll(hex, property[role as keyof typeof sentinel]);
  }

  return bound;
}

/**
 * The colours left in a rendered SVG that are neither a sentinel nor bound.
 *
 * The test reads this rather than eyeballing the stylesheet, so "Mermaid's own
 * palette is not on the page" is a thing the build checks rather than a thing
 * someone once looked at.
 */
export function strayColours(boundSvg: string): string[] {
  const found = new Set<string>();

  for (const match of boundSvg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    found.add(match[0].toLowerCase());
  }
  for (const match of boundSvg.matchAll(/(?:rgba?|hsla?)\([^)]*\)/g)) {
    found.add(match[0]);
  }

  return [...found].filter(
    (colour) => !(INERT_COLOURS as readonly string[]).includes(colour),
  );
}
