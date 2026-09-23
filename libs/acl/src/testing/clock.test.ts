import { describe, expect, it } from 'vitest';

import {
  InvalidFreshnessError,
  MissingFreshnessBudgetError,
} from '../errors.js';
import { parseMatrix } from '../parse-matrix.js';
import type { Matrix } from '../types.js';

import { fixtureClock } from './clock.js';

const fetchedAt = 1_000_000;

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

const subject = { id: 'u1' };

describe('fixtureClock', () => {
  const clock = fixtureClock(contract, { fetchedAt });

  it('settles the validation instant', () => {
    expect(clock.fetchedAt).toBe(fetchedAt);
  });

  it('takes the budget from the document', () => {
    expect(clock.budget).toBe(60_000);
    expect(clock.expiresAt).toBe(fetchedAt + 60_000);
  });

  it("takes the holder's shorter ceiling", () => {
    expect(fixtureClock(contract, { fetchedAt, maxStale: 5_000 }).budget).toBe(
      5_000,
    );
  });

  it("refuses to extend the owner's ceiling", () => {
    expect(
      fixtureClock(contract, { fetchedAt, maxStale: 600_000 }).budget,
    ).toBe(60_000);
  });

  it('accepts an instant in any of the three spellings', () => {
    const iso = fixtureClock(contract, { fetchedAt: '1970-01-01T00:16:40Z' });

    const date = fixtureClock(contract, { fetchedAt: new Date(fetchedAt) });

    expect(iso.fetchedAt).toBe(fetchedAt);
    expect(date.fetchedAt).toBe(fetchedAt);
  });

  it('reads the wall clock when the test names no instant', () => {
    const before = Date.now();

    const wall = fixtureClock(contract);

    expect(wall.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('counts an arbitrary offset from the validation instant', () => {
    expect(clock.at(1_500)).toBe(fetchedAt + 1_500);
  });
});

describe('the instants a fixtureClock names', () => {
  const clock = fixtureClock(contract, { fetchedAt });
  const access = parseMatrix(contract, clock.options);

  it('decides at the last instant inside the budget', () => {
    expect(access.can(subject, 'invoice', 'read', {}, clock.fresh).reason).toBe(
      'allow',
    );
  });

  it('refuses at the first instant past it', () => {
    expect(access.can(subject, 'invoice', 'read', {}, clock.stale).reason).toBe(
      'stale-contract',
    );
  });

  it('hands the holder the options the instants were derived from', () => {
    expect(clock.options).toEqual({ fetchedAt });
    expect(
      fixtureClock(contract, { fetchedAt, maxStale: 5_000 }).options,
    ).toEqual({ fetchedAt, maxStale: 5_000 });
  });

  it('brackets the tightened budget as well', () => {
    const tight = fixtureClock(contract, { fetchedAt, maxStale: 5_000 });
    const holder = parseMatrix(contract, tight.options);

    expect(holder.can(subject, 'invoice', 'read', {}, tight.fresh).reason).toBe(
      'allow',
    );
    expect(holder.can(subject, 'invoice', 'read', {}, tight.stale).reason).toBe(
      'stale-contract',
    );
  });
});

describe('a freshness budget a fixtureClock cannot compute', () => {
  it('refuses a document that states no maxStale', () => {
    const silent: Matrix = {
      version: contract.version,
      permissions: contract.permissions,
    };

    expect(() => fixtureClock(silent, { fetchedAt })).toThrow(
      MissingFreshnessBudgetError,
    );
  });

  it('refuses a validation instant that does not parse', () => {
    expect(() => fixtureClock(contract, { fetchedAt: 'not a date' })).toThrow(
      InvalidFreshnessError,
    );
  });

  it('refuses a local ceiling that is not a span of milliseconds', () => {
    expect(() => fixtureClock(contract, { fetchedAt, maxStale: -1 })).toThrow(
      InvalidFreshnessError,
    );
    expect(() =>
      fixtureClock(contract, { fetchedAt, maxStale: Infinity }),
    ).toThrow(InvalidFreshnessError);
  });
});
