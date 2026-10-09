import { describe, expect, it } from 'vitest';

import { reportDivergence } from './divergence.js';
import type { DivergenceReport } from './divergence.js';

const REPORT: DivergenceReport = {
  kind: 'unversioned',
  message: 'one of the two carries no config version',
};

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
});
