import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { availability } from './tokens/availability.js';
import { boxArt } from './tokens/box-art.js';
import { complexity } from './tokens/complexity.js';
import {
  hueClass,
  ladderClass,
  paletteClass,
  stateClass,
} from './tokens/class-names.js';
import { customProperties } from './tokens/custom-properties.js';
import { mechanism } from './tokens/mechanism.js';

const styles = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

/** The comment blocks, dropped: prose mentions colours and mentions the word hex. */
const rules = styles.replace(/\/\*[\s\S]*?\*\//g, '');

describe('styles.css', () => {
  it('imports the generated custom properties', () => {
    expect(
      styles.split('\n').find((line) => line.startsWith('@import')),
      `styles.css must import tokens.generated.css, and the build inlines it ` +
        `into dist/styles.css.`,
    ).toBe("@import './tokens.generated.css';");
  });

  it('carries no literal colour', () => {
    const literals = [
      ...rules.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi),
    ].map((match) => match[0]);

    expect(
      literals,
      `A colour in this file is a colour that is not in the token modules, so ` +
        `it is in no diff a reviewer reads as a palette change and in no ` +
        `contrast test. Add it to src/tokens/ and reference the custom property.`,
    ).toEqual([]);
  });

  /**
   * `var(--baize-chlak)` compiles, renders nothing, and the element inherits
   * whatever its parent had. This is the check that makes the TypeScript side the
   * source in practice rather than only on paper.
   */
  it('references only custom properties that exist', () => {
    const generated = new Set(customProperties.map(([name]) => name));
    const local = new Set(
      [...rules.matchAll(/^\s*(--baize-[\w-]+)\s*:/gm)].map(
        (match) => match[1] as string,
      ),
    );
    const referenced = new Set(
      [...rules.matchAll(/var\(\s*(--baize-[\w-]+)/g)].map(
        (match) => match[1] as string,
      ),
    );

    const unknown = [...referenced].filter(
      (name) => !generated.has(name) && !local.has(name),
    );

    expect(
      unknown,
      `These custom properties are referenced by styles.css and declared ` +
        `nowhere: neither in the generated token block nor in this file.`,
    ).toEqual([]);
  });

  /**
   * The gradient palettes are a stand-in for photography, not a third
   * informational colour system. The rule that keeps them that way is mechanical:
   * a `--baize-box-art-*` value may only ever become the box-art tile's own
   * gradient stop, never a text colour, a border or a fill anywhere else.
   */
  it('uses the box-art palettes only as the placeholder tile gradient', () => {
    const misuse = rules
      .split('\n')
      .filter((line) => line.includes('--baize-box-art-'))
      .filter((line) => !/^\s*--baize-art-(?:from|via|to):/.test(line));

    expect(
      misuse,
      `A box-art palette value reached something other than the placeholder's ` +
        `own gradient stops. Mechanism hue and availability are the two ` +
        `informational colour systems; these gradients must not become a third.`,
    ).toEqual([]);
  });

  /**
   * The class-name resolvers are the contract a non-React consumer has with this
   * file: `apps/storefront` is pure Astro and emits these names from frontmatter,
   * so a token added without its rule is a class that styles nothing and a rule
   * renamed without its token is a rule nothing reaches.
   */
  it('declares a rule for every class the token enums resolve to', () => {
    const selectors = new Set(
      [...rules.matchAll(/^\.([\w-]+)[\s,{]/gm)].map(
        (match) => match[1] as string,
      ),
    );
    const expected = [
      ...Object.keys(mechanism).map((name) =>
        hueClass(name as keyof typeof mechanism),
      ),
      ...Object.keys(availability).map((name) =>
        stateClass(name as keyof typeof availability),
      ),
      ...Object.keys(boxArt).map((name) =>
        paletteClass(name as keyof typeof boxArt),
      ),
      ...Object.keys(complexity).map((stop) =>
        ladderClass(Number(stop) as keyof typeof complexity),
      ),
    ];

    expect(
      expected.filter((name) => !selectors.has(name)),
      `These classes are what hueClass, stateClass, paletteClass and ladderClass ` +
        `resolve to, ` +
        `and this file declares no rule for them. A consumer emitting one gets ` +
        `an element with no hue, no state colour or no gradient.`,
    ).toEqual([]);
  });

  /**
   * Two layout failures no render test on the components would see. A storefront
   * card carries three stats and a back office reads five off the same device, so
   * a fixed column template put the fourth figure under the first. And a figure is
   * `white-space: nowrap`, so a column that will not fit cannot shrink -- in a
   * grid track it lands on top of its neighbour instead of moving to a new row.
   */
  it('lets the stat line take any number of stats and wrap them', () => {
    const rule = /\.baize-statline\s*\{([^}]*)\}/.exec(rules)?.[1] ?? '';

    expect(
      rule,
      `The stat line takes as many stats as a page gives it, and wraps rather ` +
        `than overlapping when they do not fit across.`,
    ).toContain('flex-wrap: wrap');
    expect(rule).toContain('display: flex');
    expect(rule).not.toMatch(/grid-template-columns:\s*repeat\(\s*\d/);
  });

  it('sets tabular numerals on the figure class', () => {
    expect(
      /\.baize-figure\s*\{[^}]*font-variant-numeric:\s*tabular-nums/.test(
        rules,
      ),
      `The design makes numeric alignment a requirement: a stat column, a price ` +
        `and a quantity all have to align down the page.`,
    ).toBe(true);
  });
});
