import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { bundleStylesheet } from '../vite.config.js';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CodeBlock,
  CopyValue,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Switch,
} from './index.js';

const STYLES = join(import.meta.dirname, 'styles');
const LAYERS = ['reset', 'tokens', 'base', 'layout', 'components'];

const read = (name: string) => readFileSync(join(STYLES, name), 'utf8');
/** Comments dropped: prose mentions colours and token names. */
const rules = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const bundled = bundleStylesheet(join(STYLES, 'index.css'));
const all = rules(bundled);

describe('the layer order', () => {
  it('is declared before anything else, in the order the package promises', () => {
    const first = rules(read('index.css')).trim().split('\n')[0];

    expect(first).toBe(`@layer ${LAYERS.join(', ')};`);
  });

  it('puts each source file in the layer of its name', () => {
    const imports = [
      ...rules(read('index.css')).matchAll(
        /^@import '\.\/([\w-]+)\.css' layer\(([\w-]+)\);$/gm,
      ),
    ].map((match) => [match[1], match[2]]);

    expect(imports).toEqual([
      ['reset', 'reset'],
      ['tokens', 'tokens'],
      ['base', 'base'],
      ['layout', 'layout'],
      ['components', 'components'],
    ]);
  });

  it('survives the build as one file with every rule inside a layer', () => {
    expect(all).not.toMatch(/@import/);

    // Top-level statements of the bundled file: the order statement, then one
    // block per layer. A rule outside a layer would beat every theme token.
    const topLevel = all
      .split('\n')
      .filter((line) => /^\S/.test(line))
      .filter((line) => line !== '}');

    expect(topLevel).toEqual([
      `@layer ${LAYERS.join(', ')};`,
      ...LAYERS.map((layer) => `@layer ${layer} {`),
    ]);
  });
});

describe('the tokens', () => {
  const tokens = rules(read('tokens.css'));
  const declared = new Set(
    [...all.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1] as string),
  );

  it('are the only place a literal colour appears', () => {
    const elsewhere = LAYERS.filter((layer) => layer !== 'tokens').flatMap(
      (layer) =>
        [
          ...rules(read(`${layer}.css`)).matchAll(
            /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi,
          ),
        ].map((match) => `${layer}.css: ${match[0]}`),
    );

    expect(
      elsewhere,
      'A colour outside tokens.css is one a theme cannot reach.',
    ).toEqual([]);
  });

  it('declare every custom property a rule reads', () => {
    const read_ = new Set(
      [...all.matchAll(/var\(\s*(--[\w-]+)/g)].map(
        (match) => match[1] as string,
      ),
    );

    expect(
      [...read_].filter((name) => !declared.has(name)),
      'var() of an undeclared property renders nothing and inherits silently.',
    ).toEqual([]);
  });

  it('carry plain values, with no Open Props reference and no Open Props name', () => {
    const openProps =
      /--(?:size-\d|font-size-\d|font-weight-\d|font-sans|font-mono|font-serif|radius-\d|radius-round|shadow-\d|ease-\d|ease-(?:in|out|in-out)-\d|gray-\d)/;

    expect(all).not.toMatch(openProps);
  });

  it('give every token a value in both colour schemes where it is a colour', () => {
    const colours = [
      ...tokens.matchAll(/^\s*(--(?:color|tone)-[\w-]+):\s*([^;]+);/gm),
    ]
      .filter(([, , value]) => !/^var\(/.test((value as string).trim()))
      .filter(
        ([, name]) =>
          !/^--color-(?:switch-thumb|backdrop)$/.test(name as string),
      )
      .filter(([, , value]) => !(value as string).includes('light-dark('))
      .map(([, name]) => name);

    expect(colours).toEqual([]);
  });

  it('leave a dialog the margin that centres it as a modal', () => {
    // The UA stylesheet centres a modal <dialog> with `margin: auto`; a reset
    // that zeroes every margin pins it to the top-left corner.
    const zeroed = [
      ...rules(read('reset.css')).matchAll(/([^{}]+)\{\s*margin:\s*0;/g),
    ].map(([, selector]) => (selector as string).trim());

    expect(zeroed.length).toBeGreaterThan(0);
    for (const selector of zeroed) expect(selector).toMatch(/:not\(dialog\)/);
  });

  it('use no font file', () => {
    expect(all).not.toMatch(/@font-face|url\(/);
  });

  it('map every built-in tone onto --tone and --tone-surface', () => {
    for (const tone of ['positive', 'negative', 'warning']) {
      const rule = new RegExp(
        `\\[data-tone='${tone}'\\]\\s*\\{\\s*--tone: var\\(--tone-${tone}\\);\\s*--tone-surface: var\\(--tone-${tone}-surface\\);`,
      );
      expect(all, tone).toMatch(rule);
    }
  });
});

/** sRGB channels (0–1, clamped) of `oklch(L% C H)`, through OKLab. */
function oklchToSrgb(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = l / 100;
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return linear.map((v) => Math.min(1, Math.max(0, v))) as [
    number,
    number,
    number,
  ];
}

/** WCAG 2 contrast ratio of two linear-light sRGB colours. */
function contrast(x: [number, number, number], y: [number, number, number]) {
  const luminance = ([r, g, b]: [number, number, number]) =>
    0.2126 * r + 0.7152 * g + 0.0722 * b;
  const hi = Math.max(luminance(x), luminance(y));
  const lo = Math.min(luminance(x), luminance(y));
  return (hi + 0.05) / (lo + 0.05);
}

describe('the tones', () => {
  const tokens = rules(read('tokens.css'));
  /** The light and dark oklch of a token written as light-dark(oklch, oklch). */
  const schemes = (name: string) => {
    const match = new RegExp(
      `${name}:\\s*light-dark\\(\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)\\s*,\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`,
    ).exec(tokens);
    expect(match, name).not.toBeNull();
    const [l1, c1, h1, l2, c2, h2] = (match as RegExpExecArray)
      .slice(1)
      .map(Number) as [number, number, number, number, number, number];
    return {
      light: oklchToSrgb(l1, c1, h1),
      dark: oklchToSrgb(l2, c2, h2),
    };
  };

  it('read at 4.5:1 or more on their own surface, in both schemes', () => {
    // A badge is small uppercase text, so it needs the normal-text ratio.
    for (const tone of ['positive', 'negative', 'warning']) {
      const ink = schemes(`--tone-${tone}`);
      const ground = schemes(`--tone-${tone}-surface`);
      for (const scheme of ['light', 'dark'] as const)
        expect(
          contrast(ink[scheme], ground[scheme]),
          `${tone} in ${scheme}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the component classes', () => {
  /** Every class the components render, read off their markup. */
  const rendered = renderToStaticMarkup(
    <>
      <Button>a</Button>
      <ButtonLink href="/">a</ButtonLink>
      <Field id="f" label="a" hint="h" error="e" />
      <Switch checked label="a" />
      <Badge>a</Badge>
      <Card title="a">a</Card>
      <PageHeader title="a" />
      <EmptyState>a</EmptyState>
      <Alert>a</Alert>
      <CopyValue value="a" copyLabel="c" copiedLabel="d" />
      <CodeBlock code="a" label="l" copyLabel="c" />
      <Dialog id="d" title="t" closeLabel="c">
        a
      </Dialog>
    </>,
  );
  const classes = new Set(
    [...rendered.matchAll(/class="([^"]+)"/g)].flatMap((match) =>
      (match[1] as string).split(' '),
    ),
  );

  it('each have a rule in the stylesheet', () => {
    const selectors = new Set(
      [...all.matchAll(/\.([a-z][\w-]*)/g)].map((match) => match[1] as string),
    );

    expect(
      [...classes].filter((name) => !selectors.has(name)),
      'A component renders a class that no rule styles.',
    ).toEqual([]);
  });

  it('include the shell the package promises', () => {
    for (const name of [
      'app-shell',
      'app-header',
      'app-nav',
      'app-main',
      'app-footer',
      'widget',
      'data-table',
    ]) {
      expect(all, name).toMatch(new RegExp(`\\.${name}\\b`));
    }
    expect(all).toMatch(/\.widget \{\s*display: contents;/);
  });
});
