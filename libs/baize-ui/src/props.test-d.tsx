import { describe, expectTypeOf, it } from 'vitest';

import { Stat, StatLine } from './components/stat-line.js';
import { BoxArtPlaceholder } from './components/box-art.js';
import { Chip } from './components/tags.js';
import { Title } from './components/typography.js';
import type { StatProps } from './components/stat-line.js';

/**
 * The mechanical half of decision 5: props are already-formatted values.
 *
 * A component that takes a number renders it, which means it owns a locale
 * decision -- the en dash in `1–5`, the thousands separator, the unit, the
 * 24-hour clock -- that belongs where the request context is. A component that
 * takes a domain object is one step from fetching, because the next request is
 * for the field the object does not carry yet.
 *
 * The rest of the rule is review. This is what fails a build.
 */
describe('a stat figure', () => {
  it('is a string', () => {
    expectTypeOf<StatProps['figure']>().toEqualTypeOf<string>();
    expectTypeOf<StatProps['label']>().toEqualTypeOf<string>();
  });

  it('rejects a number and a range', () => {
    // @ts-expect-error -- 70 is a number; the app formats it as `70 min`.
    <Stat figure={70} label="playtime" />;
    // @ts-expect-error -- a tuple is a domain value; the app formats it as `1–5`.
    <Stat figure={[1, 5]} label="players" />;
    // @ts-expect-error -- a Date carries no formatting, so nothing here takes one.
    <Stat figure={new Date()} label="released" />;
  });
});

describe('a token-selecting prop', () => {
  it('takes an enum member and not a colour', () => {
    <Chip mechanism="areaControl">area control</Chip>;
    // @ts-expect-error -- a hex here would be a palette nothing tested.
    <Chip mechanism="#C98BE0">area control</Chip>;
    // @ts-expect-error -- `area control` is the label's spelling, not the token's.
    <Chip mechanism="area control">area control</Chip>;

    <BoxArtPlaceholder palette="soot" />;
    // @ts-expect-error -- a palette is a token name, not a gradient.
    <BoxArtPlaceholder palette="linear-gradient(#fff, #000)" />;
  });
});

/**
 * The colour ladder carries complexity and nothing else, and the props are where
 * that holds: a title takes a stop on the ramp, and there is no way to hand it a
 * mechanism instead.
 */
describe('a game title', () => {
  it('takes a ramp stop and no mechanism', () => {
    <Title complexity={3}>Wingspan</Title>;
    // @ts-expect-error -- mechanism is categorical and never colours a title.
    <Title mechanism="engineBuilding">Wingspan</Title>;
    // @ts-expect-error -- 6 is off the five-stop ramp.
    <Title complexity={6}>Wingspan</Title>;
  });
});

describe('the stat line', () => {
  it('takes children and no game', () => {
    // @ts-expect-error -- no component here takes a domain object.
    <StatLine game={{ players: '1–5' }} />;
  });
});
