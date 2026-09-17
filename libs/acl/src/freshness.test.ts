import { describe, expect, it } from 'vitest';

import {
  InvalidFreshnessError,
  InvalidMatrixError,
  MissingFreshnessBudgetError,
} from './errors.js';
import { hydratePolicy } from './hydrate-policy.js';
import { parseMatrix } from './parse-matrix.js';
import type { Matrix } from './types.js';

const contract: Matrix = {
  version: 'orders@7',
  maxStale: 60_000,
  permissions: [
    {
      key: 'invoice.read',
      object: 'invoice',
      action: 'read',
      rules: [{ id: 'anyone', when: [] }],
    },
  ],
};

/** The same document with the owner stating no budget. */
const silent: Matrix = {
  version: contract.version,
  permissions: contract.permissions,
};

const subject = { id: 'u1' };
const fetchedAt = 1_000_000;

describe('a holder inside its freshness budget', () => {
  const access = parseMatrix(contract, { fetchedAt });

  it('answers normally at the instant it validated', () => {
    expect(access.can(subject, 'invoice', 'read', {}, fetchedAt).reason).toBe(
      'allow',
    );
  });

  it('answers normally at the last instant of the budget', () => {
    expect(
      access.can(subject, 'invoice', 'read', {}, fetchedAt + 60_000).reason,
    ).toBe('allow');
  });
});

describe('a holder past its freshness budget', () => {
  const access = parseMatrix(contract, { fetchedAt });
  const expired = fetchedAt + 60_001;

  it('refuses every key with stale-contract', () => {
    expect(access.can(subject, 'invoice', 'read', {}, expired)).toEqual({
      key: 'invoice.read',
      allowed: false,
      reason: 'stale-contract',
    });
  });

  it('refuses a key it does not hold with the same reason', () => {
    expect(access.can(subject, 'ledger', 'reconcile', {}, expired)).toEqual({
      key: 'ledger.reconcile',
      allowed: false,
      reason: 'stale-contract',
    });
  });

  it('refuses every object in a canMany list', () => {
    expect(
      access.canMany(subject, 'invoice', 'read', [{}, {}], expired),
    ).toEqual([
      { key: 'invoice.read', allowed: false, reason: 'stale-contract' },
      { key: 'invoice.read', allowed: false, reason: 'stale-contract' },
    ]);
  });

  it('returns empty field maps alongside the refusal', () => {
    expect(
      access.canFields(subject, 'invoice', 'read', {}, 'read', {}, expired),
    ).toEqual({
      allowed: false,
      action: {
        key: 'invoice.read',
        allowed: false,
        reason: 'stale-contract',
      },
      fields: {},
      reasons: {},
    });
  });

  it('gives every key in capabilities the same reason', () => {
    expect(access.capabilities(subject, expired)).toEqual({
      'invoice.read': {
        key: 'invoice.read',
        allowed: false,
        reason: 'stale-contract',
      },
    });
  });

  it('keeps answering readsObject, which is a fact about the document', () => {
    expect(access.readsObject('invoice', 'read')).toBe(false);
  });

  it('carries the reason through a bound handle', () => {
    const bound = access.authorize(subject, { now: expired });
    expect(bound.can('invoice', 'read').reason).toBe('stale-contract');
  });
});

describe('the local ceiling', () => {
  it('shortens the owner bound', () => {
    const access = parseMatrix(contract, { fetchedAt, maxStale: 1_000 });
    expect(
      access.can(subject, 'invoice', 'read', {}, fetchedAt + 1_001).reason,
    ).toBe('stale-contract');
  });

  it('never extends it', () => {
    const access = parseMatrix(contract, { fetchedAt, maxStale: 600_000 });
    expect(
      access.can(subject, 'invoice', 'read', {}, fetchedAt + 60_001).reason,
    ).toBe('stale-contract');
  });
});

describe('a holder that claims no freshness', () => {
  it('runs under no budget at all', () => {
    const access = parseMatrix(contract);
    expect(
      access.can(subject, 'invoice', 'read', {}, fetchedAt + 1e12).reason,
    ).toBe('allow');
  });

  it('runs under no budget on a document that states one', () => {
    const access = hydratePolicy({ ...contract, maxStale: 0 });
    expect(access.can(subject, 'invoice', 'read', {}, 1e12).reason).toBe(
      'allow',
    );
  });
});

describe('a freshness claim the document cannot honour', () => {
  it('refuses a fetchedAt against a document that states no maxStale', () => {
    expect(() => parseMatrix(silent, { fetchedAt })).toThrow(
      MissingFreshnessBudgetError,
    );
  });

  it('refuses a fetchedAt that is not an instant', () => {
    expect(() => parseMatrix(contract, { fetchedAt: 'yesterday' })).toThrow(
      InvalidFreshnessError,
    );
  });

  it('refuses a local ceiling that is not a span', () => {
    expect(() => parseMatrix(contract, { fetchedAt, maxStale: -1 })).toThrow(
      InvalidFreshnessError,
    );
  });

  it('refuses a document whose maxStale is not a span', () => {
    expect(() =>
      parseMatrix({ ...contract, maxStale: '60000' as unknown as number }),
    ).toThrow(InvalidMatrixError);
  });
});

describe('an unusable clock against a budget', () => {
  it('decides nothing about staleness and lands where it always did', () => {
    const access = parseMatrix(contract, { fetchedAt });
    expect(
      access.can(subject, 'invoice', 'read', {}, 'not-an-instant').reason,
    ).toBe('allow');
  });
});

describe('the budget on the frozen document', () => {
  it('crosses a JSON round trip with the rest of the envelope', () => {
    const access = parseMatrix(contract, { fetchedAt });
    const again = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(again.maxStale).toBe(60_000);
  });

  it('stays absent when the document omits it', () => {
    expect(parseMatrix(silent).matrix).not.toHaveProperty('maxStale');
  });
});
