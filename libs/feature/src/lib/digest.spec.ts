import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import type { FeatureConfig } from './config.js';

const document: FeatureConfig = {
  version: 41,
  features: [
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ],
};

describe('configDigest', () => {
  it('returns 32 hex characters', () => {
    expect(configDigest(document)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('agrees for two documents differing only in key order', () => {
    const permuted: FeatureConfig = {
      features: [...document.features],
      version: document.version,
    };

    expect(configDigest(permuted)).toBe(configDigest(document));
  });

  it('agrees for an absent key and a key written undefined', () => {
    const explicit: FeatureConfig = { ...document, schemaVersion: undefined };

    expect(configDigest(explicit)).toBe(configDigest(document));
  });

  it('agrees whatever digest the document already carries', () => {
    const carried: FeatureConfig = { ...document, digest: 'not a digest' };

    expect(configDigest(carried)).toBe(configDigest(document));
  });

  it('disagrees when the rules array order changes', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };
    const other: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [...rules].reverse() }],
    };

    expect(configDigest(other)).not.toBe(configDigest(one));
  });

  it('disagrees when a version changes and nothing else does', () => {
    const bumped: FeatureConfig = { ...document, version: 42 };

    expect(configDigest(bumped)).not.toBe(configDigest(document));
  });

  it('agrees across a trip through JSON', () => {
    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });
});
