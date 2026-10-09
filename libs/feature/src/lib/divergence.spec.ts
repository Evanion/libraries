import { describe, expect, it } from 'vitest';

import { reportDivergence } from './divergence.js';
import type { DivergenceObserver, DivergenceReport } from './divergence.js';

const REPORT: DivergenceReport = {
  kind: 'unversioned',
  message: 'one of the two carries no config version',
};

/** Every kind a report declares. `divergence.test-d.ts` holds the count at four. */
const KINDS: readonly DivergenceReport['kind'][] = [
  'config-version',
  'unversioned',
  'missing-field',
  'decision-differs',
];

/** An observer that raises the value it was built with. */
function raising(value: unknown): DivergenceObserver {
  return () => {
    throw value;
  };
}

describe('reportDivergence', () => {
  it('hands the observer the report it was given', () => {
    const seen: DivergenceReport[] = [];

    reportDivergence((report) => seen.push(report), REPORT);

    expect(seen).toEqual([REPORT]);
  });

  it('discards what an observer throws', () => {
    expect(() =>
      reportDivergence(() => {
        throw new Error('observer');
      }, REPORT),
    ).not.toThrow();
  });

  it('calls nothing when no observer was installed', () => {
    expect(() => reportDivergence(undefined, REPORT)).not.toThrow();
  });

  it('reads nothing back off the report the observer altered', () => {
    const report: DivergenceReport = { ...REPORT };

    reportDivergence((given) => {
      given.kind = 'config-version';
    }, report);

    expect(report.kind).toBe('config-version');
  });

  it('hands over the report itself and not a copy of it', () => {
    const seen: DivergenceReport[] = [];

    reportDivergence((report) => seen.push(report), REPORT);

    expect(seen[0]).toBe(REPORT);
  });

  it('calls the observer once for one report', () => {
    let calls = 0;

    reportDivergence(() => {
      calls += 1;
    }, REPORT);

    expect(calls).toBe(1);
  });

  it('calls the observer twice for the same report handed over twice', () => {
    const seen: DivergenceReport[] = [];
    const observer: DivergenceObserver = (report) => {
      seen.push(report);
    };

    reportDivergence(observer, REPORT);
    reportDivergence(observer, REPORT);

    expect(seen).toEqual([REPORT, REPORT]);
  });

  it('answers nothing', () => {
    expect(reportDivergence(() => undefined, REPORT)).toBeUndefined();
  });

  it('delivers each kind a report declares', () => {
    const seen: DivergenceReport['kind'][] = [];

    for (const kind of KINDS) {
      reportDivergence((report) => seen.push(report.kind), {
        kind,
        message: `a report of kind ${kind}`,
      });
    }

    expect(seen).toEqual([...KINDS]);
  });

  it('delivers the key, the field and both sides whole', () => {
    const report: DivergenceReport = {
      kind: 'decision-differs',
      key: 'cta',
      field: 'tenantId',
      shipped: {
        version: 'v1',
        enabled: true,
        variant: 'control',
        source: 'weighted',
      },
      local: {
        version: 2,
        enabled: false,
        variant: 'treatment',
        source: 'fallback',
      },
      message: 'the server and the client decided cta differently',
    };
    const seen: DivergenceReport[] = [];

    reportDivergence((given) => seen.push(given), report);

    expect(seen).toEqual([report]);
  });

  it('leaves every member of the report as the observer saw it', () => {
    const report: DivergenceReport = {
      kind: 'decision-differs',
      key: 'cta',
      field: 'tenantId',
      shipped: {
        version: 'v1',
        enabled: true,
        variant: 'control',
        source: 'weighted',
      },
      local: {
        version: 2,
        enabled: false,
        variant: 'treatment',
        source: 'fallback',
      },
      message: 'the server and the client decided cta differently',
    };
    let atHandover: DivergenceReport | undefined;

    reportDivergence((given) => {
      atHandover = structuredClone(given);
    }, report);

    expect(report).toEqual(atHandover);
  });

  it('delivers a numeric key at zero', () => {
    const report: DivergenceReport<number> = {
      kind: 'missing-field',
      key: 0,
      field: 'tenantId',
      message: 'the client context carries no tenantId',
    };
    const seen: (number | undefined)[] = [];

    reportDivergence<number>((given) => seen.push(given.key), report);

    expect(seen).toEqual([0]);
  });

  it('delivers an empty message', () => {
    const seen: string[] = [];

    reportDivergence((report) => seen.push(report.message), {
      kind: 'unversioned',
      message: '',
    });

    expect(seen).toEqual(['']);
  });

  it('discards a raise that carries no Error', () => {
    expect(() => reportDivergence(raising('a string'), REPORT)).not.toThrow();
    expect(() => reportDivergence(raising(undefined), REPORT)).not.toThrow();
    expect(() => reportDivergence(raising(null), REPORT)).not.toThrow();
    expect(() => reportDivergence(raising({ code: 7 }), REPORT)).not.toThrow();
  });

  it('keeps what the observer did before it raised', () => {
    const seen: DivergenceReport[] = [];

    reportDivergence((report) => {
      seen.push(report);
      throw new Error('observer');
    }, REPORT);

    expect(seen).toEqual([REPORT]);
  });

  it('calls the next observer after one of them raised', () => {
    const seen: string[] = [];

    reportDivergence(raising(new Error('observer')), REPORT);
    reportDivergence(() => seen.push('the second observer'), REPORT);

    expect(seen).toEqual(['the second observer']);
  });

  it('carries on past a report an observer makes from inside itself', () => {
    const seen: string[] = [];

    reportDivergence(() => {
      reportDivergence(raising(new Error('the inner observer')), REPORT);
      seen.push('the outer observer finished');
    }, REPORT);

    expect(seen).toEqual(['the outer observer finished']);
  });

  it('discards the raise from an observer that is no function', () => {
    const observer = {} as unknown as DivergenceObserver;

    expect(() => reportDivergence(observer, REPORT)).not.toThrow();
  });

  it('discards the rejection from an async observer', async () => {
    const unhandled: unknown[] = [];
    const collect = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', collect);

    try {
      reportDivergence(async () => {
        await Promise.resolve();
        throw new Error('observer');
      }, REPORT);
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', collect);
    }

    expect(unhandled).toEqual([]);
  });

  it('hands a rejection handler to a thenable an observer answers', () => {
    const rejectionHandlers: unknown[] = [];
    const thenable = {
      then(_onFulfilled: unknown, onRejected: unknown) {
        rejectionHandlers.push(onRejected);
      },
    };

    reportDivergence(() => thenable, REPORT);

    expect(rejectionHandlers).toEqual([expect.any(Function)]);
  });

  it('keeps what the observer did before it rejected', async () => {
    const seen: DivergenceReport[] = [];
    const unhandled: unknown[] = [];
    const collect = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', collect);

    try {
      reportDivergence(async (report) => {
        seen.push(report);
        await Promise.resolve();
        throw new Error('observer');
      }, REPORT);
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', collect);
    }

    expect(seen).toEqual([REPORT]);
    expect(unhandled).toEqual([]);
  });
});
