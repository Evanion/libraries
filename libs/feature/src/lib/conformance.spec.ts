import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketOf } from './bucketing.js';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';
import type { EvaluationContext } from './types.js';

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

/** The context the fixture states, with its instant read as one. */
function supplied(): EvaluationContext {
  const { now, ...rest } = fixture.context;
  return { ...rest, now: new Date(now) };
}

/**
 * What an engine answers for the fixture's context over `config`.
 *
 * Each transform below drops one member a careless port might not read, so the
 * decisions that port computes are the decisions this engine computes from a
 * document without the member. A fixture every such port reproduces proves
 * nothing about the member.
 */
function decisionsOver(config: FeatureConfig): unknown {
  // A transform changes the document's content, and `createFeatures` refuses a
  // document whose stated digest no longer covers it.
  const engine = createFeatures({ ...config, digest: undefined });
  return JSON.parse(JSON.stringify(engine.resolve(supplied())));
}

/** The document a port that never evaluates a condition reads. */
function conditionsDropped(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) =>
      definition.rules
        ? {
            ...definition,
            rules: definition.rules.map(({ when, ...rule }) => rule),
          }
        : definition,
    ),
  };
}

/**
 * The document a port that reads variants in array order reads.
 *
 * `validateVariants` refuses a document that declares an order on none of a
 * feature's variants, so the walk such a port performs is written here as the
 * orders it amounts to: the array index of each variant.
 */
function ordersByPosition(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) =>
      definition.variants
        ? {
            ...definition,
            variants: definition.variants.map((variant, at) => ({
              ...variant,
              order: at,
            })),
          }
        : definition,
    ),
  };
}

/**
 * The document a port that never reads a stated seed reads.
 *
 * `bucketing.ts` defaults a rollout seed to the feature key and
 * `variantSeedOf` defaults an assignment seed to the key with `:variant`
 * appended, so those two values are what such a port hashes on.
 */
function seedsDefaulted(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) => ({
      ...definition,
      rules: definition.rules?.map((rule) =>
        rule.rollout
          ? {
              ...rule,
              rollout: { ...rule.rollout, seed: String(definition.key) },
            }
          : rule,
      ),
      variantSeed: definition.variants
        ? `${String(definition.key)}:variant`
        : definition.variantSeed,
    })),
  };
}

/**
 * The document a port that decides a feature on its first rule reads.
 *
 * `decide` OR-s a feature's rules: it walks them in order and the first one
 * that matches enables the feature, so a rule after a rule that did not match
 * still decides. A port that reads `rules[0]` and stops answers for the
 * document holding that rule alone.
 */
function firstRuleOnly(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) =>
      definition.rules
        ? { ...definition, rules: definition.rules.slice(0, 1) }
        : definition,
    ),
  };
}

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
    expect(conditions.filter((each) => each.op === 'eq').length).toBe(3);
    expect(conditions.filter((each) => each.op === 'after').length).toBe(1);
    expect(conditions.filter((each) => each.op === 'before').length).toBe(1);
    expect(rules.filter((each) => each.rollout).length).toBe(2);
    expect(
      definitions
        .flatMap((each) => each.variants ?? [])
        .map((variant) => variant.order),
    ).toEqual([1, 0]);
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

  it('publishes the three members the spec names, and no fourth', () => {
    // § 9 defines the artifact as one serialized document, one context and the
    // expected decisions, beside the `bucketOf` vectors the variants spec
    // commits to. Those vectors are a separate file, so a bucketing change is
    // ratcheted in one place and a rollout rule can be added here without a
    // hash being hand-computed for its seed.
    expect(Object.keys(fixture).sort()).toEqual([
      'config',
      'context',
      'decisions',
      'note',
    ]);
  });

  it('prints, in each decision that buckets, the number the hash answers', () => {
    const subject = fixture.context['targetingKey'] as string;
    const ctaSeed = fixture.config.features.find(
      (definition) => definition.key === 'cta',
    )?.variantSeed;
    const assigned = fixture.decisions['cta'] as {
      assignment?: { bucket?: number };
    };

    // `bucketing.spec.ts` holds the hash itself. This holds the number the
    // published decision prints against it, so a hand-edited fixture cannot
    // publish a bucket the engine never computes.
    expect(ctaSeed).toBeTypeOf('string');
    expect(assigned.assignment?.bucket).toBe(
      bucketOf(subject, ctaSeed as string),
    );
  });

  it('enables a feature on a rule a rule before it did not match', () => {
    const counts = fixture.config.features.map(
      (definition) => definition.rules?.length ?? 0,
    );
    const matched = fixture.decisions['pro-perks'] as {
      enabled: boolean;
      reason: string;
      rule: string;
    };

    // Point 4 of `decide`'s precedence OR-s the rules. A fixture whose
    // features carry one rule each is reproduced by a port that returns on
    // `rules[0]`, and that port ships every feature whose first rule is the
    // narrow one off.
    expect(Math.max(...counts)).toBeGreaterThan(1);
    expect(matched).toMatchObject({
      enabled: true,
      reason: 'rule-match',
      rule: 'pro-plan',
    });
    expect(decisionsOver(firstRuleOnly(fixture.config))).not.toEqual(
      fixture.decisions,
    );
  });

  it('publishes a decision a condition refused', () => {
    // Every condition in the fixture once held, so an engine whose condition
    // evaluator answers true for anything reproduced all of it. That engine is
    // the one reading the document with every `when` removed.
    expect(fixture.decisions['enterprise-only']).toMatchObject({
      enabled: false,
      reason: 'no-rule-matched',
      rules: [{ matched: false, failed: { field: 'plan', op: 'eq' } }],
    });
    expect(decisionsOver(conditionsDropped(fixture.config))).not.toEqual(
      fixture.decisions,
    );
  });

  it('lists its variants in an order its own `order` values disagree with', () => {
    const variants = fixture.config.features.flatMap(
      (definition) => definition.variants ?? [],
    );
    const sorted = [...variants].sort(
      (one, other) => (one.order ?? 0) - (other.order ?? 0),
    );

    // `bucketingPosition` falls back to the array index, so `order` decides
    // nothing where the two agree, and a port reading array position passes a
    // fixture whose arrays are already sorted.
    expect(variants.map((variant) => variant.name)).not.toEqual(
      sorted.map((variant) => variant.name),
    );
    expect(decisionsOver(ordersByPosition(fixture.config))).not.toEqual(
      fixture.decisions,
    );
  });

  it('seeds a rollout and an assignment on something other than the key', () => {
    const nav = fixture.config.features.find(
      (definition) => definition.key === 'new-nav',
    );
    const cta = fixture.config.features.find(
      (definition) => definition.key === 'cta',
    );

    // A fixture stating only the two defaults proves nothing about a port that
    // never reads either member, and such a port buckets every subject wrong
    // on the first production document that states a seed of its own.
    expect(nav?.rules?.[0]?.rollout?.seed).not.toBe('new-nav');
    expect(cta?.variantSeed).not.toBe('cta:variant');
    expect(decisionsOver(seedsDefaulted(fixture.config))).not.toEqual(
      fixture.decisions,
    );
  });

  it('decides differently under a clock no caller supplied', () => {
    const { now, ...rest } = fixture.context;

    const ambient = createFeatures(fixture.config).resolve(rest);

    // `summer-sale` is bounded on both sides of the instant the fixture states,
    // so an engine reading the host clock in place of the `now` it was handed
    // answers something else. A single boundary in the past is one every wall
    // clock agrees with, and a port that dropped `context.now` passed on it.
    expect(now).toBeTypeOf('string');
    expect(JSON.parse(JSON.stringify(ambient))).not.toEqual(fixture.decisions);
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
