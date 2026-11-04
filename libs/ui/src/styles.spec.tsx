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
