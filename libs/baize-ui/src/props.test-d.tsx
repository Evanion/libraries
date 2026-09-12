import { describe, expectTypeOf, it } from 'vitest';

import { Stat, StatLine } from './components/stat-line.js';
import { BoxArtPlaceholder } from './components/box-art.js';
import { MechanismTag } from './components/tags.js';
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
    <MechanismTag label="area control" mechanism="areaControl" />;
    // @ts-expect-error -- a hex here would be a palette nothing tested.
    <MechanismTag label="area control" mechanism="#C98BE0" />;
    // @ts-expect-error -- `area control` is the label's spelling, not the token's.
    <MechanismTag label="area control" mechanism="area control" />;

    <BoxArtPlaceholder palette="soot" />;
    // @ts-expect-error -- a palette is a token name, not a gradient.
    <BoxArtPlaceholder palette="linear-gradient(#fff, #000)" />;
  });
});

describe('the stat line', () => {
  it('takes children and no game', () => {
    // @ts-expect-error -- no component here takes a domain object.
    <StatLine game={{ players: '1–5' }} />;
  });
});
