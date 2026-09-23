import { describe, expect, it } from 'vitest';

import type { Matrix, Permission } from '../types.js';

import {
  ContractDriftError,
  assertNoContractDrift,
  contractDrift,
  describeContractDrift,
  type DecisionCase,
  type MatrixDiffer,
} from './drift.js';

const refund: Permission = {
  key: 'orders:order.refund',
  object: 'orders:order',
  action: 'refund',
  rules: [
    {
      id: 'bookseller',
      when: [{ field: 'subject.roles', op: 'contains', value: 'bookseller' }],
    },
  ],
};

const cancel: Permission = {
  key: 'orders:order.cancel',
  object: 'orders:order',
  action: 'cancel',
  rules: [
    {
      id: 'owner',
      when: [{ field: 'object.ownerId', op: 'eq', path: 'subject.id' }],
    },
  ],
};

const pinned: Matrix = {
  version: 'orders@7',
  permissions: [refund, cancel],
};

const bookseller = { id: 'u1', roles: ['bookseller'] };

const cases: readonly DecisionCase[] = [
  {
    name: 'the refund button',
    subject: bookseller,
    key: 'orders:order',
    action: 'refund',
  },
  {
    name: 'the cancel button',
    subject: bookseller,
    key: 'orders:order',
    action: 'cancel',
    object: { ownerId: 'u1' },
  },
];

describe('contractDrift', () => {
  describe('a contract that did not move', () => {
    const report = contractDrift({ pinned, fetched: pinned, cases });

    it('reports no removed key', () => {
      expect(report.removed).toEqual([]);
    });

    it('reports no changed decision', () => {
      expect(report.changed).toEqual([]);
    });

    it('carries both versions', () => {
      expect(report.pinnedVersion).toBe('orders@7');
      expect(report.fetchedVersion).toBe('orders@7');
    });

    describe('assertNoContractDrift', () => {
      it('passes the assertion', () => {
        expect(() =>
          assertNoContractDrift({ pinned, fetched: pinned, cases }),
        ).not.toThrow();
      });
    });
  });

  describe('a producer that removed a published key', () => {
    const fetched: Matrix = { version: 'orders@8', permissions: [cancel] };
    const report = contractDrift({ pinned, fetched, cases });

    it('names the key it dropped', () => {
      expect(report.removed).toEqual(['orders:order.refund']);
    });

    it('reports the decision that key carried as changed as well', () => {
      expect(report.changed.map((change) => change.name)).toEqual([
        'the refund button',
      ]);
    });

    it('answers rather than throwing, because both documents fail closed', () => {
      expect(report.changed[0]?.fetched.reason).toBe('unknown-action');
      expect(report.changed[0]?.pinned.reason).toBe('allow');
    });

    it('spells the removal as a broken contract', () => {
      expect(describeContractDrift(report)).toContain(
        '1 published key(s) removed, which breaks the contract',
      );
    });

    describe('assertNoContractDrift', () => {
      it('throws a ContractDriftError carrying the report', () => {
        try {
          assertNoContractDrift({ pinned, fetched, cases });
          expect.unreachable();
        } catch (error) {
          expect(error).toBeInstanceOf(ContractDriftError);
          expect((error as ContractDriftError).report.removed).toEqual([
            'orders:order.refund',
          ]);
        }
      });
    });
  });

  describe('a producer that changed a decision', () => {
    const narrowed: Permission = {
      ...refund,
      rules: [
        {
          id: 'bookseller-on-tier',
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
            { field: 'subject.tier', op: 'eq', value: 'permanent' },
          ],
        },
      ],
    };
    const fetched: Matrix = {
      version: 'orders@8',
      permissions: [narrowed, cancel],
    };
    const report = contractDrift({ pinned, fetched, cases });

    it('removes no key', () => {
      expect(report.removed).toEqual([]);
    });

    it('names the case whose decision moved', () => {
      expect(report.changed.map((change) => change.name)).toEqual([
        'the refund button',
      ]);
    });

    it('carries both decisions', () => {
      expect(report.changed[0]?.pinned.allowed).toBe(true);
      expect(report.changed[0]?.fetched.allowed).toBe(false);
    });

    it('spells the change as a change and not as a break', () => {
      const text = describeContractDrift(report);
      expect(text).toContain('1 decision(s) changed');
      expect(text).not.toContain('breaks the contract');
    });

    describe('assertNoContractDrift', () => {
      it('fails the assertion', () => {
        expect(() => assertNoContractDrift({ pinned, fetched, cases })).toThrow(
          ContractDriftError,
        );
      });
    });
  });

  describe('a producer that only added a key', () => {
    const archive: Permission = {
      key: 'orders:order.archive',
      object: 'orders:order',
      action: 'archive',
      rules: [{ id: 'anyone', when: [] }],
    };
    const fetched: Matrix = {
      version: 'orders@8',
      permissions: [refund, cancel, archive],
    };

    it('names the added key', () => {
      expect(contractDrift({ pinned, fetched, cases }).added).toEqual([
        'orders:order.archive',
      ]);
    });

    describe('assertNoContractDrift', () => {
      it('passes the assertion, because a wider surface breaks nothing', () => {
        expect(() =>
          assertNoContractDrift({ pinned, fetched, cases }),
        ).not.toThrow();
      });
    });
  });

  describe('the decisions a replay compares', () => {
    it('reports a refusal whose missing paths grew', () => {
      const reads: Permission = {
        ...cancel,
        denyRules: [
          {
            id: 'locked',
            when: [{ field: 'object.locked', op: 'eq', value: true }],
          },
        ],
      };
      const fetched: Matrix = {
        version: 'orders@8',
        permissions: [refund, reads],
      };
      const report = contractDrift({
        pinned,
        fetched,
        cases: [
          {
            name: 'the cancel button',
            subject: bookseller,
            key: 'orders:order',
            action: 'cancel',
            object: { ownerId: 'u1' },
          },
        ],
      });

      expect(report.changed[0]?.fetched.missing).toEqual(['object.locked']);
    });

    it('settles one instant for every case that names none', () => {
      const windowed: Permission = {
        key: 'orders:order.refund',
        object: 'orders:order',
        action: 'refund',
        rules: [
          { id: 'window', when: [{ field: 'now', op: 'after', value: 1_000 }] },
        ],
      };
      const before: Matrix = { version: 'a', permissions: [windowed] };
      const report = contractDrift({
        pinned: before,
        fetched: before,
        cases: [{ subject: bookseller, key: 'orders:order', action: 'refund' }],
        now: 2_000,
      });

      expect(report.changed).toEqual([]);
    });

    it('lets a case name its own instant', () => {
      const windowed: Permission = {
        key: 'orders:order.refund',
        object: 'orders:order',
        action: 'refund',
        rules: [
          { id: 'window', when: [{ field: 'now', op: 'after', value: 1_000 }] },
        ],
      };
      const opened: Matrix = { version: 'a', permissions: [windowed] };
      const closed: Matrix = {
        version: 'b',
        permissions: [
          {
            ...windowed,
            rules: [
              {
                id: 'window',
                when: [{ field: 'now', op: 'after', value: 5_000 }],
              },
            ],
          },
        ],
      };
      const report = contractDrift({
        pinned: opened,
        fetched: closed,
        cases: [
          {
            subject: bookseller,
            key: 'orders:order',
            action: 'refund',
            now: 3_000,
          },
        ],
        now: 10_000,
      });

      expect(report.changed).toHaveLength(1);
    });

    it('names a case after its permission key when the case names nothing', () => {
      const fetched: Matrix = { version: 'orders@8', permissions: [cancel] };
      const report = contractDrift({
        pinned,
        fetched,
        cases: [{ subject: bookseller, key: 'orders:order', action: 'refund' }],
      });

      expect(report.changed[0]?.name).toBe('orders:order.refund');
    });

    it('applies no freshness budget of its own', () => {
      const budgeted: Matrix = { ...pinned, maxStale: 1 };
      const report = contractDrift({
        pinned: budgeted,
        fetched: budgeted,
        cases,
        now: Date.now() + 10_000,
      });

      expect(report.changed).toEqual([]);
    });
  });

  describe('the diffMatrix seam', () => {
    it('carries whatever the diff returned', () => {
      const fetched: Matrix = { version: 'orders@8', permissions: [cancel] };
      const diff: MatrixDiffer<{ widened: string[] }> = (a, b) => ({
        widened: [String(a.version), String(b.version)],
      });

      const report = contractDrift({ pinned, fetched, cases, diff });

      expect(report.diff).toEqual({ widened: ['orders@7', 'orders@8'] });
    });

    it('is handed the two documents in pinned-then-fetched order', () => {
      const seen: Matrix[] = [];
      const fetched: Matrix = {
        version: 'orders@8',
        permissions: [refund, cancel],
      };
      contractDrift({
        pinned,
        fetched,
        diff: (a, b) => {
          seen.push(a, b);
          return null;
        },
      });

      expect(seen.map((m) => m.version)).toEqual(['orders@7', 'orders@8']);
    });

    it('reports undefined where no diff was passed', () => {
      expect(contractDrift({ pinned, fetched: pinned }).diff).toBeUndefined();
    });
  });
});

describe('describeContractDrift', () => {
  it('says so when nothing moved', () => {
    expect(
      describeContractDrift(contractDrift({ pinned, fetched: pinned, cases })),
    ).toContain('no key removed and no decision changed');
  });

  it('leads with the versions it compared', () => {
    expect(
      describeContractDrift(contractDrift({ pinned, fetched: pinned })),
    ).toMatch(/^contract drift, orders@7 -> orders@7/);
  });

  it('names an added key', () => {
    const archive: Permission = {
      key: 'orders:order.archive',
      object: 'orders:order',
      action: 'archive',
      rules: [{ id: 'anyone', when: [] }],
    };
    const fetched: Matrix = {
      version: 'orders@8',
      permissions: [refund, cancel, archive],
    };

    expect(describeContractDrift(contractDrift({ pinned, fetched }))).toContain(
      '1 key(s) added: orders:order.archive',
    );
  });
});
