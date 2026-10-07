import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import type { FeatureConfig } from './config.js';

interface Fixture {
  config: FeatureConfig;
  context: { now: string; [field: string]: unknown };
  decisions: Record<string, unknown>;
}

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../conformance/config-decisions.json'),
    'utf8',
  ),
) as Fixture;

describe('the published cross-process fixture', () => {
  it('states the digest of the document it carries', () => {
    expect(fixture.config.digest).toBe(configDigest(fixture.config));
  });

  it('produces the decisions it publishes', () => {
    const features = createFeatures(fixture.config);
    const { now, ...rest } = fixture.context;

    const decisions = features.resolve({ ...rest, now: new Date(now) });

    expect(JSON.parse(JSON.stringify(decisions))).toEqual(fixture.decisions);
  });

  it('carries an explicit offset on every instant it states', () => {
    const text = JSON.stringify(fixture);

    // ECMA-262 reads a date-time string with no offset as local time, so an
    // offsetless instant here would decide differently per host. Issue #284.
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T[\d:.]+"/);
  });
});
