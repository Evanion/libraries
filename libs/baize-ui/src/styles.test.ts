import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { customProperties } from './tokens/custom-properties.js';

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
