import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketOf } from './bucketing.js';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

/** One bucketing vector: the bucket `value` falls in under `seed`. */
interface Vector {
  value: string;
  seed: string;
  bucket: number;
}

interface Fixture {
  config: FeatureConfig;
  context: { now: string; [field: string]: unknown };
  decisions: Record<string, unknown>;
  buckets: readonly Vector[];
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

/**
 * An ISO 8601 date-time, with the offset it states captured.
 *
 * ECMA-262 reads a date-time string carrying no offset as local time, so an
 * implementation in Stockholm and one in Tokyo read one fixture two ways.
 * Issue #284.
 */
const INSTANT = /\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})?/;

function offsetless(text: string): readonly string[] {
  // A global copy per call, because `matchAll` and `test` both read and write
  // `lastIndex` and `matchAll` carries it onto the copy it walks with. One
  // shared global regex starts each walk wherever its last reader stopped, so
  // the instants before that offset are never inspected.
  return [...text.matchAll(new RegExp(INSTANT, 'g'))]
    .filter((found) => found[1] === undefined)
    .map((found) => found[0]);
}

describe('the guard the fixture is held to', () => {
  it('names an offsetless instant wherever one sits', () => {
    const bad = JSON.stringify({
      value: '2026-06-01T12:00:00',
      other: '2026-06-01T12:00:00.000Z',
    });

    expect(offsetless(bad)).toEqual(['2026-06-01T12:00:00']);
  });

  it('names an instant a reader before it already matched past', () => {
    const bad = JSON.stringify({
      note: 'Captured 2026-06-01T12:00:00 from the reference engine.',
      at: '2026-06-01T12:00:00.000Z',
    });

    // `toMatch` runs `RegExp.prototype.test`, which advances `lastIndex` on a
    // global regex. The first instant is the one the guard exists to catch.
    expect(bad).toMatch(INSTANT);
    expect(offsetless(bad)).toEqual(['2026-06-01T12:00:00']);
  });

  it('names the same instant on a second call as on the first', () => {
    const bad = JSON.stringify({ value: '2026-06-01T12:00:00' });

    expect(offsetless(bad)).toEqual(offsetless(bad));
    expect(offsetless(bad)).toEqual(['2026-06-01T12:00:00']);
  });

  it('names nothing in the fixture, which states an instant to name', () => {
    const text = JSON.stringify(fixture);

    expect(text).toMatch(INSTANT);
    expect(offsetless(text)).toEqual([]);
  });
});

describe('the document the fixture publishes', () => {
  it('is named in the files array the tarball is built from', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { files: readonly string[] };

    expect(manifest.files).toContain('conformance');
  });

  it('passes the checker every holder runs before it installs', () => {
    const result = parseFeatureConfig(fixture.config);

    expect(result.ok === false && result.issues).toBeFalsy();
    expect(result.ok).toBe(true);
  });

  it('states a digest of this document and of no other', () => {
    const moved: FeatureConfig = {
      ...fixture.config,
      features: [...fixture.config.features].reverse(),
    };

    expect(configDigest(moved)).not.toBe(fixture.config.digest);
  });

  it('re-serializes to the document it publishes, without the digest', () => {
    const { digest, ...body } = fixture.config;

    const written = serializeConfig(createFeatures(fixture.config));

    expect(digest).toBeTypeOf('string');
    expect(written).toEqual(body);
  });

  it('reaches every reason a second implementation has to produce', () => {
    const reasons = Object.values(fixture.decisions).map(
      (decision) => (decision as { reason: string }).reason,
    );

    expect(new Set(reasons)).toEqual(
      new Set([
        'default-on',
        'explicitly-off',
        'dependency-off',
        'rule-match',
        'no-rule-matched',
      ]),
    );
  });

  it('reaches every mechanism a second implementation has to get right', () => {
    const definitions = fixture.config.features;
    const rules = definitions.flatMap((definition) => definition.rules ?? []);
    const conditions = rules.flatMap((rule) => rule.when ?? []);

    expect(definitions.filter((each) => each.dependsOn).length).toBeGreaterThan(
      0,
    );
    expect(conditions.filter((each) => each.op === 'eq').length).toBe(1);
    expect(conditions.filter((each) => each.op === 'after').length).toBe(1);
    expect(rules.filter((each) => each.rollout).length).toBe(2);
    expect(
      definitions
        .flatMap((each) => each.variants ?? [])
        .map((variant) => variant.order),
    ).toEqual([0, 1]);
  });

  it('publishes an assignment, so a port proves its bucketing', () => {
    const assigned = Object.values(fixture.decisions).filter(
      (decision) => (decision as { assignment?: unknown }).assignment,
    );

    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatchObject({
      variant: expect.any(String),
      assignment: { source: 'weighted', bucket: expect.any(Number) },
    });
  });

  it('decides one rollout against the subject and one for it', () => {
    const refused = fixture.decisions['new-nav'] as {
      enabled: boolean;
      rules: readonly { rollout?: { percent: number; member: boolean } }[];
    };
    const admitted = fixture.decisions['gift-wrap'] as {
      enabled: boolean;
      reason: string;
    };

    // One rollout each way, because membership is one bit. A port that answers
    // `false` for every rollout, or `true` for every rollout, reproduces one of
    // these two decisions and disagrees with the other.
    expect(refused.enabled).toBe(false);
    expect(refused.rules[0]?.rollout?.member).toBe(false);
    expect(admitted.enabled).toBe(true);
    expect(admitted.reason).toBe('rule-match');
  });

  it('states the bucket of every pair it buckets on', () => {
    // The decisions above state which side of the threshold each subject fell
    // on, which a port reproduces by accident about half the time whatever hash
    // it uses. These are the numbers that say the hash agrees. `bucketing.spec
    // .ts` holds the same obligation inside this package, and `package.json`
    // keeps no `.spec.ts` in the tarball, so a port author reads it here.
    for (const vector of fixture.buckets) {
      expect(bucketOf(vector.value, vector.seed)).toBe(vector.bucket);
    }
  });

  it('states a bucket for every seed its own decisions turn on', () => {
    const definitions = fixture.config.features;
    const seeds = [
      ...definitions.flatMap((definition) =>
        (definition.rules ?? [])
          .map((rule) => rule.rollout?.seed)
          .filter((seed): seed is string => seed !== undefined),
      ),
      ...definitions
        .map((definition) => definition.variantSeed)
        .filter((seed): seed is string => seed !== undefined),
    ];

    expect(seeds).not.toHaveLength(0);
    expect(new Set(fixture.buckets.map((vector) => vector.seed))).toEqual(
      new Set(seeds),
    );
    for (const vector of fixture.buckets) {
      expect(vector.value).toBe(fixture.context['targetingKey']);
    }
  });

  it('answers one decision for every definition it carries', () => {
    const features = createFeatures(fixture.config);
    const { now, ...rest } = fixture.context;

    const decisions = features.resolve({ ...rest, now: new Date(now) });

    expect(Object.keys(decisions)).toHaveLength(fixture.config.features.length);
    expect(Object.keys(fixture.decisions)).toHaveLength(
      fixture.config.features.length,
    );
  });
});
