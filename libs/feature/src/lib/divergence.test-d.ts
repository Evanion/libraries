import { describe, expectTypeOf, it } from 'vitest';

import { reportDivergence } from './divergence.js';
import type {
  DivergenceObserver,
  DivergenceReport,
  DivergenceSide,
} from './divergence.js';
import type { Features } from './features.js';
import type { Decision } from './types.js';

/** A store built from a literal, whose version member is the one compared. */
type AnyFeatures = Features<Record<string, never>>;

/** How the engine says a variant was chosen. */
type Assignment = NonNullable<Decision['assignment']>;

const REPORT: DivergenceReport = {
  kind: 'unversioned',
  message: 'one of the two carries no config version',
};

describe('DivergenceReport', () => {
  it('names four kinds and no fifth', () => {
    expectTypeOf<DivergenceReport['kind']>().toEqualTypeOf<
      'config-version' | 'unversioned' | 'missing-field' | 'decision-differs'
    >();
  });

  it('refuses a kind nothing reports', () => {
    // @ts-expect-error the four kinds are the whole set.
    const report: DivergenceReport = { kind: 'drift', message: 'a fifth kind' };

    expectTypeOf(report).toEqualTypeOf<DivergenceReport>();
  });

  it('defaults its key to a string', () => {
    expectTypeOf<DivergenceReport['key']>().toEqualTypeOf<string | undefined>();
  });

  it('reads the key union a caller names', () => {
    const report: DivergenceReport<'cta' | 'hero'> = {
      kind: 'decision-differs',
      key: 'hero',
      message: 'the two processes decided hero differently',
    };

    expectTypeOf(report.key).toEqualTypeOf<'cta' | 'hero' | undefined>();
  });

  it('refuses a key the union it was given does not name', () => {
    const report: DivergenceReport<'cta' | 'hero'> = {
      kind: 'decision-differs',
      // @ts-expect-error `banner` is no member of the union.
      key: 'banner',
      message: 'a key nothing declares',
    };

    expectTypeOf(report).toEqualTypeOf<DivergenceReport<'cta' | 'hero'>>();
  });

  it('reads a numeric key, which is the other form of a feature key', () => {
    const report: DivergenceReport<number> = {
      kind: 'missing-field',
      key: 7,
      field: 'tenantId',
      message: 'the client context carries no tenantId',
    };

    expectTypeOf(report.key).toEqualTypeOf<number | undefined>();
  });

  it('refuses a key type that is no feature key', () => {
    // @ts-expect-error a feature key is a string or a number.
    type Bad = DivergenceReport<boolean>;

    expectTypeOf<Bad>().not.toBeNever();
  });

  it('requires the kind', () => {
    // @ts-expect-error a report with no kind names no divergence.
    const report: DivergenceReport = { message: 'a report with no kind' };

    expectTypeOf(report).toEqualTypeOf<DivergenceReport>();
  });

  it('requires the message', () => {
    // @ts-expect-error every report carries the sentence a reader meets.
    const report: DivergenceReport = { kind: 'unversioned' };

    expectTypeOf(report).toEqualTypeOf<DivergenceReport>();
  });

  it('leaves the key, the field and both sides optional', () => {
    const report: DivergenceReport = { kind: 'unversioned', message: 'one' };

    expectTypeOf(report.field).toEqualTypeOf<string | undefined>();
    expectTypeOf(report.shipped).toEqualTypeOf<DivergenceSide | undefined>();
    expectTypeOf(report.local).toEqualTypeOf<DivergenceSide | undefined>();
  });
});

describe('DivergenceSide', () => {
  it('leaves every member optional', () => {
    const side: DivergenceSide = {};

    expectTypeOf(side).toEqualTypeOf<DivergenceSide>();
  });

  it('names the versions a store reports', () => {
    expectTypeOf<DivergenceSide['version']>().toEqualTypeOf<
      AnyFeatures['version']
    >();
  });

  it('names the sources an assignment names', () => {
    expectTypeOf<DivergenceSide['source']>().toEqualTypeOf<
      Assignment['source'] | undefined
    >();
  });

  it('refuses a source the engine never assigns', () => {
    // @ts-expect-error the engine assigns four sources and no fifth.
    const side: DivergenceSide = { source: 'random' };

    expectTypeOf(side).toEqualTypeOf<DivergenceSide>();
  });

  it('refuses a variant that is no string', () => {
    // @ts-expect-error a variant is named by a string.
    const side: DivergenceSide = { variant: 7 };

    expectTypeOf(side).toEqualTypeOf<DivergenceSide>();
  });
});

describe('DivergenceObserver', () => {
  it('answers nothing', () => {
    expectTypeOf<ReturnType<DivergenceObserver>>().toEqualTypeOf<void>();
  });

  it('reads a report on the key it was written for', () => {
    expectTypeOf<Parameters<DivergenceObserver<'cta'>>>().toEqualTypeOf<
      [DivergenceReport<'cta'>]
    >();
  });

  it('takes an observer written for every key where one key is reported', () => {
    expectTypeOf<DivergenceObserver<string>>().toExtend<
      DivergenceObserver<'cta'>
    >();
  });

  it('refuses an observer written for one key where every key is reported', () => {
    expectTypeOf<DivergenceObserver<'cta'>>().not.toExtend<
      DivergenceObserver<string>
    >();
  });
});

describe('reportDivergence', () => {
  it('answers nothing', () => {
    expectTypeOf(reportDivergence(undefined, REPORT)).toEqualTypeOf<void>();
  });

  it('reads undefined where an observer goes', () => {
    const observer: DivergenceObserver | undefined = undefined;

    expectTypeOf(reportDivergence(observer, REPORT)).toEqualTypeOf<void>();
  });

  it('refuses a report whose key its parameter does not name', () => {
    reportDivergence<'cta'>(undefined, {
      kind: 'decision-differs',
      // @ts-expect-error the call was told the key is `cta`.
      key: 'hero',
      message: 'a key the parameter does not name',
    });
  });

  it('refuses an observer written for another key', () => {
    const observer: DivergenceObserver<'hero'> = () => undefined;

    // @ts-expect-error the observer reads reports on `hero` and this one is on `cta`.
    reportDivergence<'cta'>(observer, {
      kind: 'decision-differs',
      key: 'cta',
      message: 'an observer written for another key',
    });
  });

  it('refuses a call that hands over no report', () => {
    // @ts-expect-error the report is the second argument and is required.
    reportDivergence(undefined);
  });

  it('refuses a key type that is no feature key', () => {
    // @ts-expect-error a feature key is a string or a number.
    reportDivergence<boolean>(undefined, {
      kind: 'unversioned',
      message: 'a key type nothing declares',
    });
  });
});
