import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketOf } from './bucketing.js';
import { configDigest } from './digest.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
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

/**
 * The document a port that stops at a rule's first condition reads.
 *
 * `evaluateRule` AND-s a rule's conditions: it returns on the first one that
 * does not hold and matches only when every one of them held. A port that
 * reads `when[0]` and a port that ORs the array both answer for the document
 * holding each rule's first condition alone.
 */
function conditionsAfterFirstDropped(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) =>
      definition.rules
        ? {
            ...definition,
            rules: definition.rules.map((rule) =>
              rule.when ? { ...rule, when: rule.when.slice(0, 1) } : rule,
            ),
          }
        : definition,
    ),
  };
}

/**
 * The document a port that gives every variant one share reads.
 *
 * `assignmentOf` normalises each `weight` over the set's total, so a set whose
 * weights are all equal bands the bucket space evenly. That is the banding a
 * port which never reads `weight` computes, whatever the weights say.
 */
function weightsEven(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) =>
      definition.variants
        ? {
            ...definition,
            variants: definition.variants.map((variant) => ({
              ...variant,
              weight: 1,
            })),
          }
        : definition,
    ),
  };
}

/**
 * The document a port that hashes `targetingKey` whatever the document says
 * reads.
 *
 * `rolloutField` falls back to `DEFAULT_ROLLOUT_FIELD` for a rollout stating no
 * `by`, and `assignVariant` falls back to it for a definition stating no
 * `variantBy`, so those two defaults are what such a port buckets on.
 */
function fieldsDefaulted(config: FeatureConfig): FeatureConfig {
  return {
    ...config,
    features: config.features.map((definition) => ({
      ...definition,
      rules: definition.rules?.map((rule) =>
        rule.rollout
          ? {
              ...rule,
              rollout: { ...rule.rollout, by: DEFAULT_ROLLOUT_FIELD },
            }
          : rule,
      ),
      variantBy: definition.variants
        ? DEFAULT_ROLLOUT_FIELD
        : definition.variantBy,
    })),
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
    expect(conditions.filter((each) => each.op === 'eq').length).toBe(5);
    expect(conditions.filter((each) => each.op === 'after').length).toBe(1);
    expect(conditions.filter((each) => each.op === 'before').length).toBe(2);
    expect(rules.filter((each) => each.rollout).length).toBe(2);
    expect(definitions.filter((each) => each.variants).length).toBeGreaterThan(
      0,
    );
    expect(
      definitions
        .flatMap((each) => each.variants ?? [])
        .filter((variant) => variant.order === undefined),
    ).toEqual([]);
  });

  it('publishes an assignment, so a port proves its bucketing', () => {
    const assigned = Object.values(fixture.decisions).filter(
      (decision) => (decision as { assignment?: unknown }).assignment,
    );

    expect(assigned).toHaveLength(3);
    expect(assigned).toMatchObject([
      {
        variant: expect.any(String),
        assignment: { source: 'weighted', bucket: expect.any(Number) },
      },
      {
        variant: expect.any(String),
        assignment: { source: 'weighted', bucket: expect.any(Number) },
      },
      {
        variant: expect.any(String),
        assignment: { source: 'fallback' },
      },
    ]);
  });

  it('assigns a split whose bucketing field the context does not carry', () => {
    const tour = fixture.config.features.find(
      (definition) => definition.key === 'onboarding-tour',
    );
    const ordered = [...(tour?.variants ?? [])].sort(
      (one, other) => (one.order ?? 0) - (other.order ?? 0),
    );
    const decision = fixture.decisions['onboarding-tour'] as {
      variant?: string;
      assignment?: { source?: string; by?: string; bucket?: number };
    };

    // Condition 3 of § 9 of `docs/specs/2026-09-23-feature-hydration.md`. A
    // context carrying no `variantBy` field fixes what every implementation
    // answers without one: the variant first in the bucketing order, under
    // `assignment.source: 'fallback'` and with no bucket. The array lists that
    // variant second, so a port handing back `variants[0]` disagrees.
    expect(tour?.variantBy).toBe('tenantId');
    expect(fixture.context['tenantId']).toBeUndefined();
    expect(ordered[0]?.name).not.toBe(tour?.variants?.[0]?.name);
    expect(decision.variant).toBe(ordered[0]?.name);
    expect(decision.assignment).toEqual({ source: 'fallback', by: 'tenantId' });
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
    const account = fixture.context['accountId'] as string;
    const ctaSeed = fixture.config.features.find(
      (definition) => definition.key === 'cta',
    )?.variantSeed;
    const heroSeed = fixture.config.features.find(
      (definition) => definition.key === 'hero-copy',
    )?.variantSeed;
    const assigned = fixture.decisions['cta'] as {
      assignment?: { bucket?: number };
    };
    const hero = fixture.decisions['hero-copy'] as {
      assignment?: { bucket?: number };
    };

    // `bucketing.spec.ts` holds the hash itself. This holds the numbers the
    // published decisions print against it, so a hand-edited fixture cannot
    // publish a bucket the engine never computes. One of the two buckets on
    // the subject and one on the account, which is what their `by` members
    // say.
    expect(ctaSeed).toBeTypeOf('string');
    expect(heroSeed).toBeTypeOf('string');
    expect(assigned.assignment?.bucket).toBe(
      bucketOf(subject, ctaSeed as string),
    );
    expect(hero.assignment?.bucket).toBe(bucketOf(account, heroSeed as string));
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
      rules: [
        { matched: false, failed: { field: 'plan', op: 'eq' } },
        { matched: false, failed: { field: 'now', op: 'before' } },
      ],
    });
    expect(decisionsOver(conditionsDropped(fixture.config))).not.toEqual(
      fixture.decisions,
    );
  });

  it('refuses a rule on a condition one that held sits in front of', () => {
    const rule = fixture.config.features
      .find((definition) => definition.key === 'enterprise-only')
      ?.rules?.find((each) => each.id === 'lapsed-window');
    const decision = fixture.decisions['enterprise-only'] as {
      rules: readonly { rule: string; matched: boolean; failed?: unknown }[];
    };
    const outcome = decision.rules.find(
      (each) => each.rule === 'lapsed-window',
    );

    // A rule whose conditions all hold, or all fail, is decided the same way
    // by an engine that ANDs them, one that ORs them and one that reads the
    // first and stops. This rule is refused on its second condition, which
    // says the first one held, so those three engines answer three ways.
    expect(rule?.when).toHaveLength(2);
    expect(outcome?.matched).toBe(false);
    expect(outcome?.failed).toEqual(rule?.when?.[1]);
    expect(
      decisionsOver(conditionsAfterFirstDropped(fixture.config)),
    ).not.toEqual(fixture.decisions);
  });

  it('refuses a rule whose conditions held and whose rollout did not', () => {
    const rule = fixture.config.features.find(
      (definition) => definition.key === 'new-nav',
    )?.rules?.[0];
    const decision = fixture.decisions['new-nav'] as {
      rules: readonly {
        matched: boolean;
        failed?: unknown;
        rollout?: { member: boolean };
      }[];
    };
    const outcome = decision.rules[0];

    // `evaluateRule` treats the rollout as one more conjunct beside the
    // conditions. The published outcome names no failed condition, so every
    // condition held, and the rule is refused on the rollout alone -- which an
    // engine reading the two as alternatives enables.
    expect(rule?.when).toHaveLength(1);
    expect(rule?.rollout).toBeTruthy();
    expect(outcome?.failed).toBeUndefined();
    expect(outcome?.rollout?.member).toBe(false);
    expect(outcome?.matched).toBe(false);
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

  it('splits one feature on weights an even split disagrees with', () => {
    const uneven = fixture.config.features.filter((definition) => {
      const weights = definition.variants?.map((variant) => variant.weight);
      return weights && new Set(weights).size > 1;
    });

    // § 3 names `weight` as one of the four members a document carries whole.
    // A fifty-fifty split bands the bucket space where an even split bands it,
    // so a port that reads no weight answers every such feature correctly and
    // misassigns every subject on the first ramped split it is served.
    expect(uneven.length).toBeGreaterThan(0);
    expect(decisionsOver(weightsEven(fixture.config))).not.toEqual(
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

  it('buckets a rollout and a split on a field that is not the default', () => {
    const rollouts = fixture.config.features
      .flatMap((definition) => definition.rules ?? [])
      .flatMap((rule) => (rule.rollout ? [rule.rollout] : []));
    const splits = fixture.config.features.filter(
      (definition) => definition.variants,
    );

    // A document stating the default at every bucketing field is reproduced by
    // a port that reads neither member and hashes `targetingKey`, and that
    // port buckets every subject wrong on the first document that states a
    // field of its own. The same hole `seed` had.
    expect(
      rollouts.filter((rollout) => rollout.by !== DEFAULT_ROLLOUT_FIELD),
    ).not.toEqual([]);
    expect(
      splits.filter(
        (definition) => definition.variantBy !== DEFAULT_ROLLOUT_FIELD,
      ),
    ).not.toEqual([]);
    expect(decisionsOver(fieldsDefaulted(fixture.config))).not.toEqual(
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
