import { describe, expect, it } from 'vitest';

import {
  groupEntries,
  parseRegister,
  rankEntries,
  reduceDocExamples,
  reduceProject,
  reduceRun,
} from './statistics.mjs';

/**
 * The reduction behind `/testing`, against fixture reports rather than a run.
 *
 * The cases that matter are the failures: a project that collected nothing and
 * a package with no coverage summary both have to throw, because the page they
 * feed exists to be trusted and a dash where a percentage belongs turns a red
 * build into a quiet one.
 */

const passing = {
  numTotalTests: 3,
  numFailedTests: 0,
  testResults: [
    {
      name: '/w/libs/shop/src/basket.test.ts',
      assertionResults: [{}, {}],
    },
    { name: '/w/libs/shop/README.md', assertionResults: [{}] },
  ],
};

const coverage = {
  total: {
    statements: { pct: 98.16, covered: 1126, total: 1147 },
    branches: { pct: 94.42, covered: 779, total: 825 },
    functions: { pct: 97.89, covered: 232, total: 237 },
    lines: { pct: 98.63, covered: 1014, total: 1028 },
  },
  '/w/libs/shop/src/basket.ts': {
    branches: { pct: 50, covered: 1, total: 2 },
  },
  '/w/libs/shop/src/price.ts': {
    branches: { pct: 100, covered: 4, total: 4 },
  },
};

const project = { name: '@evanion/shop', root: 'libs/shop' };

describe('one library reduced', () => {
  it('counts its cases, its files and the kinds that ran', () => {
    const reduced = reduceProject({ ...project, report: passing, coverage });

    expect(reduced.cases).toBe(3);
    expect(reduced.files).toBe(2);
    expect(reduced.kinds).toEqual(['behaviour', 'doctest']);
    expect(reduced.coverage.branches).toEqual({
      pct: 94.42,
      covered: 779,
      total: 825,
    });
    expect(reduced.coverage.files).toBe(2);
  });

  it('names the files whose branches were not all taken', () => {
    const reduced = reduceProject({ ...project, report: passing, coverage });

    expect(reduced.shortfall).toEqual([
      { file: 'basket.ts', branches: 50, total: 2 },
    ]);
  });

  it('refuses a project that collected nothing', () => {
    expect(() =>
      reduceProject({
        ...project,
        report: { numTotalTests: 0, numFailedTests: 0, testResults: [] },
        coverage,
      }),
    ).toThrow('collected no test file');
  });

  it('refuses a project whose run failed', () => {
    expect(() =>
      reduceProject({
        ...project,
        report: { ...passing, numFailedTests: 1 },
        coverage,
      }),
    ).toThrow('1 failing tests');
  });

  it('refuses a package with no coverage summary', () => {
    expect(() =>
      reduceProject({ ...project, report: passing, coverage: undefined }),
    ).toThrow('no coverage summary');
  });
});

describe('the run', () => {
  it('sums the libraries and never averages them', () => {
    expect(
      reduceRun([
        { cases: 10, files: 2 },
        { cases: 5, files: 1 },
      ]),
    ).toEqual({ libraries: 2, cases: 15, files: 3 });
  });

  it('refuses a scope that matched no library', () => {
    expect(() => reduceRun([])).toThrow('no library matched');
  });

  it('counts a documented example by the file it came from', () => {
    expect(reduceDocExamples([passing])).toEqual({
      cases: 1,
      files: 1,
      fromReadme: 1,
    });
  });
});

const register = `
## Tiers

| Tier | Meaning |
| ---- | ------- |

## Tier 1 — prevented

| ID | Class | CWE / OWASP | Mechanism | Test |
| -- | ----- | ----------- | --------- | ---- |
| SEC-001 | Mass assignment | CWE-915, API3:2023 | The write axis decides every key | \`tier1-prevented.test.ts\` › SEC-001 |
| SEC-002 | Fail open | CWE-1188 | A rule with no when is refused | \`tier1-prevented.test.ts\` › SEC-002 |
| SEC-009 | Operand confusion | CWE-20 | An operand the engine would ignore is refused at construction | \`tier1-prevented.test.ts\` › SEC-009 |
| SEC-011 | Unknown key | CWE-566, API1:2023 | The untrusted path fails closed on an unknown key; the authored path throws | \`tier1-prevented.test.ts\` › SEC-011 |

## Tier 2 — the primitive exists

| ID | Class | CWE / OWASP | Primitive | Test |
| -- | ----- | ----------- | --------- | ---- |
| SEC-101 | Applying a write | CWE-915, API3:2023 | pickAllowedFields keeps what the decision marked allowed | \`tier2-primitives.test.ts\` › SEC-101 |

## Tier 3 — out of scope

| ID | Class | CWE / OWASP | Why no defence exists | Test |
| -- | ----- | ----------- | --------------------- | ---- |
| SEC-201 | Forged subject | CWE-441, A01:2021 | can authorizes the bag it is handed | \`tier3-contract.test.ts\` › SEC-201 |
`;

describe('the register', () => {
  it('reads an identifier, its tier and both identifier columns', () => {
    const entries = parseRegister(register);

    expect(entries).toHaveLength(6);
    expect(entries[0]).toMatchObject({
      id: 'SEC-001',
      tier: 1,
      cwe: ['CWE-915'],
      owasp: ['API3:2023'],
      test: 'tier1-prevented.test.ts',
    });
    expect(entries[5]?.tier).toBe(3);
  });

  it('refuses a file it parsed nothing out of', () => {
    expect(() => parseRegister('# nothing here')).toThrow('no entries');
  });

  it('ranks tier 3 first and a construction error last', () => {
    expect(
      rankEntries(parseRegister(register), { generated: ['SEC-002'] }).map(
        (entry) => entry.id,
      ),
    ).toEqual([
      'SEC-201',
      'SEC-101',
      'SEC-001',
      'SEC-011',
      'SEC-002',
      'SEC-009',
    ]);
  });

  it('ranks an entry that also defends a decision with the decision group', () => {
    const groups = groupEntries(parseRegister(register), { generated: [] });

    expect(groups[2]?.ids).toContain('SEC-011');
    expect(groups[3]?.ids).toEqual(['SEC-009']);
  });
});
