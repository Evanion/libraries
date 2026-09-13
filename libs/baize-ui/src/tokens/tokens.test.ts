import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { availability, AVAILABILITY_CONTRAST_FLOOR } from './availability.js';
import { boxArt, boxArtPhoto } from './box-art.js';
import {
  BOX_ART_MAX_DEPTH,
  BOX_ART_VIEW_BOX,
  boxArtScene,
} from './box-art-scene.js';
import { contrast } from './contrast.js';
import { customProperties } from './custom-properties.js';
import { ground } from './ground.js';
import { mechanism, MECHANISM_CONTRAST_FLOOR } from './mechanism.js';
import {
  complexity,
  COMPLEXITY_CONTRAST_FLOOR,
  complexityTier,
  complexityTiers,
} from './complexity.js';

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

  for (const [stop, value] of Object.entries(complexity)) {
    it(`holds complexity.${stop} at ${COMPLEXITY_CONTRAST_FLOOR}:1`, () => {
      const ratio = contrast(value, ground.felt);
      expect(
        Number(ratio.toFixed(2)),
        `complexity.${stop} (${value}) reaches ${ratio.toFixed(2)}:1 on felt, ` +
          `and the ladder paints a card title at 18px bold. That is under the ` +
          `14pt-bold threshold for the 3:1 allowance, so it is normal text.`,
      ).toBeGreaterThanOrEqual(COMPLEXITY_CONTRAST_FLOOR);
    });
  }

  it('rises in chroma as it rises in contrast', () => {
    const chromas = Object.values(complexity).map((value) => {
      const [r, g, b] = [1, 3, 5].map(
        (at) => Number.parseInt(value.slice(at, at + 2), 16) / 255,
      ) as [number, number, number];
      return Math.max(r, g, b) - Math.min(r, g, b);
    });

    expect(
      chromas,
      `The ladder is the only saturated informational ramp, and it reads as one ` +
        `because lightness and chroma rise together. A stop that is brighter ` +
        `than its neighbour but duller reads as a different colour, not a ` +
        `further rung.`,
    ).toEqual([...chromas].sort((a, b) => a - b));
  });

  it('runs the complexity ramp in one direction', () => {
    const ratios = Object.values(complexity).map((value) =>
      contrast(value, ground.felt),
    );
    const ascending = [...ratios].sort((a, b) => a - b);

    expect(
      ratios,
      `The complexity ramp is sequential: stop 1 is the most recessive and stop 5 ` +
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

/**
 * The generated vista.
 *
 * The tile is the one thing in this library whose output is not a fixed string,
 * so what has to hold is that it is a *function* of the seed and of nothing else,
 * and that what comes out is drawable.
 */
describe('the box-art scene', () => {
  const urns = [
    'urn:game:wingspan',
    'urn:game:brass-birmingham',
    'urn:game:gloomhaven',
    'urn:game:azul',
    'urn:game:viticulture',
    'urn:game:dominion',
    'urn:game:root',
    'urn:game:ark-nova',
    'urn:game:flamme-rouge',
    'urn:game:crokinole',
    'urn:game:spirit-island',
    'urn:game:agricola',
  ];

  it('draws the same landscape for a seed every time it is asked', () => {
    for (const urn of urns) {
      expect(boxArtScene(urn)).toEqual(boxArtScene(urn));
    }
  });

  it('draws a different landscape for every title in the catalogue', () => {
    const drawn = new Set(urns.map((urn) => JSON.stringify(boxArtScene(urn))));

    expect(
      drawn.size,
      `Twelve titles sharing a vista is a grid of wallpaper, which is the ` +
        `failure the gradient tile had and the reason this one is seeded.`,
    ).toBe(urns.length);
  });

  it('gives no two titles the same foreground twice over', () => {
    const forms = urns.map((urn) => boxArtScene(urn).foreground);

    expect(
      new Set(forms).size,
      `The near form is the shape a reader recognises a tile by across a grid.`,
    ).toBe(urns.length);
  });

  it('keeps every ridge on a depth the stylesheet paints', () => {
    for (const urn of urns) {
      const scene = boxArtScene(urn);
      expect(scene.ridges.length).toBeGreaterThanOrEqual(3);
      for (const ridge of scene.ridges) {
        expect(ridge.depth).toBeLessThanOrEqual(BOX_ART_MAX_DEPTH);
        // The fill is the crest closed down to the foot of the tile, so the two
        // cannot disagree about where the hill is.
        expect(ridge.fill.startsWith(ridge.crest)).toBe(true);
      }
    }
  });

  it('spans the full width, so no ridge leaves a gap at an edge', () => {
    for (const urn of urns) {
      for (const ridge of boxArtScene(urn).ridges) {
        expect(ridge.crest.startsWith('M0 ')).toBe(true);
        expect(ridge.crest).toContain(` L${BOX_ART_VIEW_BOX.width} `);
      }
    }
  });

  it('draws with a neutral seed rather than throwing on one', () => {
    expect(() => boxArtScene('')).not.toThrow();
  });
});

describe('a box-art photograph', () => {
  it('becomes a url a style attribute can carry', () => {
    expect(boxArtPhoto('/box-art/azul.webp')).toBe('url("/box-art/azul.webp")');
    expect(boxArtPhoto(undefined)).toBeUndefined();
  });

  /**
   * This value is written into a `style` attribute. A quote or a parenthesis
   * inside it ends the `url()` and lets whatever follows declare properties of
   * its own, so an unquotable URL is treated as no URL rather than escaped.
   */
  it('refuses anything that would break out of the url', () => {
    for (const hostile of [
      'a.webp"); color: red; --x: url("b',
      "a.webp'",
      'a.webp) url(b',
      'a.webp; color: red',
      'a b.webp',
    ]) {
      expect(boxArtPhoto(hostile)).toBeUndefined();
    }
  });
});

/**
 * The tier vocabulary, which is what keeps the ladder off colour alone: a reader
 * who sees no hue difference reads `Gateway` and `Brain-burner` instead.
 */
describe('complexity tiers', () => {
  it('covers all five ramp stops, one tier each', () => {
    expect(complexityTiers.map((tier) => tier.stop)).toEqual([1, 2, 3, 4, 5]);
  });

  it('names the tiers BoardGameGeek names', () => {
    expect(complexityTiers.map((tier) => tier.name)).toEqual([
      'Gateway',
      'Light',
      'Midweight',
      'Heavy',
      'Brain-burner',
    ]);
  });

  it('rises, so a heavier rating never lands in a shallower tier', () => {
    const floors = complexityTiers.map((tier) => tier.floor);
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
  });

  it('places every rating the catalogue carries', () => {
    const tier = (rating: number) => complexityTier(rating).name;

    expect(tier(1.1)).toBe('Gateway');
    expect(tier(1.7)).toBe('Light');
    expect(tier(1.8)).toBe('Light');
    expect(tier(2.4)).toBe('Midweight');
    expect(tier(2.9)).toBe('Midweight');
    expect(tier(3.6)).toBe('Heavy');
    expect(tier(3.8)).toBe('Heavy');
    expect(tier(3.9)).toBe('Brain-burner');
    expect(tier(4)).toBe('Brain-burner');
  });

  it('clamps rather than throwing, at both ends and off the scale', () => {
    expect(complexityTier(0).stop).toBe(1);
    expect(complexityTier(-3).stop).toBe(1);
    expect(complexityTier(9).stop).toBe(5);
    expect(complexityTier(Number.NaN).stop).toBe(1);
  });
});
