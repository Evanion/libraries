import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { availability, AVAILABILITY_CONTRAST_FLOOR } from './availability.js';
import { boxArt } from './box-art.js';
import { contrast } from './contrast.js';
import { customProperties } from './custom-properties.js';
import { ground } from './ground.js';
import { mechanism, MECHANISM_CONTRAST_FLOOR } from './mechanism.js';
import { weight, WEIGHT_CONTRAST_FLOOR } from './weight.js';

const DESIGN_SPEC = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'specs',
  '2026-09-10-demo-apps.md',
);

/**
 * The ground values the design document settles, read out of the document rather
 * than retyped here.
 *
 * A test that quotes the values it checks proves only that someone typed the same
 * thing twice. The block in the spec looks like `ink      #0C1714   page`, and
 * the names are the token names.
 */
function groundFromDesignSpec(): Record<string, string> {
  const source = readFileSync(DESIGN_SPEC, 'utf8');
  const values: Record<string, string> = {};

  for (const line of source.split('\n')) {
    const match = /^(\w+)\s+(#[0-9A-Fa-f]{6})\s+\S/.exec(line);
    if (match?.[1] && match[2]) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

describe('the ground', () => {
  const quoted = groundFromDesignSpec();

  it('is read from a design document that still carries the block', () => {
    expect(
      Object.keys(quoted).sort(),
      `No ground hexes found in ${DESIGN_SPEC}. The block this test reads is ` +
        `the approved palette; if it moved, point this test at where it went ` +
        `rather than inlining the values.`,
    ).toEqual(['chalk', 'felt', 'ink', 'lichen', 'moss', 'rule']);
  });

  for (const [name, value] of Object.entries(ground)) {
    it(`matches the approved ${name}`, () => {
      expect(
        value,
        `ground.${name} is ${value}; ${DESIGN_SPEC} says ${quoted[name]}. The ` +
          `design is approved and settled, so this file follows it.`,
      ).toBe(quoted[name]);
    });
  }
});

describe('no house colour', () => {
  /**
   * The design's structural divergence: the catalogue supplies every saturated
   * pixel, so there is no brand colour to name. This is the one guard against the
   * design eroding back towards the near-black-plus-one-accent pattern it was
   * defined against.
   */
  const HOUSE_COLOUR = /brand|accent|primary-colo|theme-colo/i;

  it('names no brand, accent or theme colour among the custom properties', () => {
    const offenders = customProperties
      .map(([name]) => name)
      .filter((name) => HOUSE_COLOUR.test(name));

    expect(
      offenders,
      `Baize has no house colour. A token named like this is one, whatever its ` +
        `value: a primary action inverts ink and parchment instead.`,
    ).toEqual([]);
  });
});

describe('contrast against felt', () => {
  for (const [name, value] of Object.entries(mechanism)) {
    it(`holds mechanism.${name} at ${MECHANISM_CONTRAST_FLOOR}:1`, () => {
      const ratio = contrast(value, ground.felt);
      expect(
        Number(ratio.toFixed(2)),
        `mechanism.${name} (${value}) reaches ${ratio.toFixed(2)}:1 on felt. ` +
          `It carries a game title and its tags, which is normal-size text.`,
      ).toBeGreaterThanOrEqual(MECHANISM_CONTRAST_FLOOR);
    });
  }

  for (const [name, value] of Object.entries(availability)) {
    it(`holds availability.${name} at ${AVAILABILITY_CONTRAST_FLOOR}:1`, () => {
      const ratio = contrast(value, ground.felt);
      expect(
        Number(ratio.toFixed(2)),
        `availability.${name} (${value}) reaches ${ratio.toFixed(2)}:1 on ` +
          `felt, and it is pill text.`,
      ).toBeGreaterThanOrEqual(AVAILABILITY_CONTRAST_FLOOR);
    });
  }

  for (const [stop, value] of Object.entries(weight)) {
    it(`holds weight.${stop} at ${WEIGHT_CONTRAST_FLOOR}:1`, () => {
      const ratio = contrast(value, ground.felt);
      expect(
        Number(ratio.toFixed(2)),
        `weight.${stop} (${value}) reaches ${ratio.toFixed(2)}:1 on felt. A ` +
          `pip is a non-text graphic, so the floor is 3:1 rather than 4.5:1.`,
      ).toBeGreaterThanOrEqual(WEIGHT_CONTRAST_FLOOR);
    });
  }

  it('runs the weight ramp in one direction', () => {
    const ratios = Object.values(weight).map((value) =>
      contrast(value, ground.felt),
    );
    const ascending = [...ratios].sort((a, b) => a - b);

    expect(
      ratios,
      `The weight ramp is sequential: stop 1 is the most recessive and stop 5 ` +
        `the brightest. Two apps built this in opposite directions, which is ` +
        `the drift the ramp exists to end.`,
    ).toEqual(ascending);
  });
});

describe('box-art palettes', () => {
  it('are named after no mechanism and no availability state', () => {
    const informational = new Set<string>([
      ...Object.keys(mechanism),
      ...Object.keys(availability),
    ]);
    const collisions = Object.keys(boxArt).filter((palette) =>
      informational.has(palette),
    );

    expect(
      collisions,
      `A palette named after a mechanism or a state teaches a reader that this ` +
        `gradient means co-op. A placeholder for a photograph means nothing.`,
    ).toEqual([]);
  });

  it('run light to dark within each palette', () => {
    for (const [palette, stops] of Object.entries(boxArt)) {
      const ordered = [stops.from, stops.via, stops.to].map((value) =>
        contrast(value, '#000000'),
      );

      expect(
        ordered,
        `boxArt.${palette} is declared light to dark; the stylesheet reads the ` +
          `last stop as the tile's ground and the first as its highlight.`,
      ).toEqual([...ordered].sort((a, b) => b - a));
    }
  });
});
