import { describe, expect, it } from 'vitest';
import { parseFeatureConfig } from './parse.js';
import type { FeatureConfig } from './config.js';

describe('parseFeatureConfig', () => {
  it('builds a store from a document', () => {
    const config: FeatureConfig = {
      version: 41,
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(result.ok && result.features.isEnabled('express')).toBe(true);
  });

  it('returns the issues and no store for a bad document', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true, dependsOn: ['b'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
      ],
    };

    const result = parseFeatureConfig(config);

    expect(
      result.ok === false && result.issues.map((each) => each.code),
    ).toEqual(['unknown-dependency', 'unknown-dependency']);
  });

  it('throws nothing for a document createFeatures would throw on', () => {
    const config: FeatureConfig = {
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
      ],
    };

    expect(() => parseFeatureConfig(config)).not.toThrow();
  });

  it('installs an observer the caller supplies', () => {
    const seen: string[] = [];
    const config: FeatureConfig = { features: [{ key: 'a', enabled: true }] };

    const result = parseFeatureConfig(config, {
      observe: (event) => {
        seen.push(event.type);
      },
    });
    if (result.ok) result.features.resolve();

    expect(seen).toEqual(['resolve']);
  });
});
