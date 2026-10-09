import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bucketOf } from './bucketing.js';
import { configDigest } from './digest.js';
import { DEFAULT_ROLLOUT_FIELD } from './fields.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { resolvePlan } from './resolve-plan.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';
import type { AsSchema } from './features.js';
import type { EvaluationContext, InferSchema, Plan } from './types.js';

interface Fixture {
  config: FeatureConfig;
  context: { now: string; [field: string]: unknown };
  decisions: Record<string, unknown>;
}

/**
 * The plan fixture, which states a build-time plan beside the three members a
 * document fixture states.
 *
 * `plan` carries the schema `createFeatures` infers from a served document,
 * which is the schema `resolvePlan` reads off the store this fixture builds.
 * `Partial` is what a file on disk earns: the JSON names an entry per feature
 * and the type system has read none of it, so every lookup answers `undefined`
 * until a case asserts otherwise.
 *
 * `buildContext` is the context the publisher planned at. A holder reproduces
 * the plan from it rather than trusting the file, and it carries the build
 * instant and nothing else, which is what leaves two entries deferred.
 */
interface PlanFixture extends Fixture {
  buildContext: Fixture['context'];
  plan: Partial<Plan<AsSchema<InferSchema<FeatureConfig['features']>>>>;
}

/** One published fixture, read off the directory the tarball carries. */
function published<T extends Fixture>(name: string): T {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, '../../conformance', name), 'utf8'),
  ) as T;
}

const fixture = published<Fixture>('config-decisions.json');
const planFixture = published<PlanFixture>('plan-decisions.json');

/** The context a fixture states, with its instant read as one. */
function supplied(stated: Fixture['context'] = fixture.context) {
  const { now, ...rest } = stated;
  return { ...rest, now: new Date(now) } satisfies EvaluationContext;
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

  it('pairs the fallback variant with the value that variant declares', () => {
    const tour = fixture.config.features.find(
      (definition) => definition.key === 'onboarding-tour',
    );
    const ordered = [...(tour?.variants ?? [])].sort(
      (one, other) => (one.order ?? 0) - (other.order ?? 0),
    );
    const decision = fixture.decisions['onboarding-tour'] as {
      value?: unknown;
    };

    // The variant and its value travel together. A port that walks the
    // bucketing order for the name and reads `variants[0].value` for the
    // payload publishes `control` with the tour's three steps, which renders
    // the experience the control exists to withhold.
    expect(decision.value).toEqual(ordered[0]?.value);
    expect(decision.value).not.toEqual(tour?.variants?.[0]?.value);
  });

  it('prints a bucket on every assignment a field settled and on no other', () => {
    const printed = Object.values(fixture.decisions)
      .map(
        (decision) =>
          (
            decision as {
              assignment?: { source: string; bucket?: number };
            }
          ).assignment,
      )
      .filter((assignment) => assignment !== undefined)
      .map((assignment) => [assignment.source, 'bucket' in assignment]);

    // `withVariant` writes `bucket` only where a bucketing value produced one,
    // so the member's presence is the one place a reader can see which
    // assignments the context decided. A port that prints the number it
    // happened to compute, or omits it everywhere, disagrees on one of these
    // three.
    expect(printed).toEqual([
      ['weighted', true],
      ['weighted', true],
      ['fallback', false],
    ]);
  });

  it('falls back on a split a port reading the default field would settle', () => {
    const defaulted = decisionsOver(fieldsDefaulted(fixture.config)) as Record<
      string,
      { assignment?: { source?: string } }
    >;

    // `onboarding-tour` buckets on `tenantId`, which this context does not
    // carry, while it does carry `targetingKey`. A port that never reads
    // `variantBy` settles the split on the default field and publishes a
    // weighted assignment, so the fallback here is an answer only a port that
    // reads the stated field reaches.
    expect(fixture.context[DEFAULT_ROLLOUT_FIELD]).toBeTypeOf('string');
    expect(defaulted['onboarding-tour']?.assignment?.source).toBe('weighted');
  });

  it('decides the same for a context stating the bucketing field as undefined', () => {
    const decisions = createFeatures(fixture.config).resolve({
      ...supplied(),
      tenantId: undefined,
    });

    // A field a context carries as `undefined` is a field it does not carry.
    // `assignVariant` reads the value, not the key, so the fallback this
    // fixture publishes is what a subject whose tenant is unknown gets however
    // the caller spelled the absence.
    expect(JSON.parse(JSON.stringify(decisions))).toEqual(fixture.decisions);
  });

  it('decides something else for a bucketing field carried as an empty string', () => {
    const decisions = createFeatures(fixture.config).resolve({
      ...supplied(),
      tenantId: '',
    });

    // `''` is a value the subject carries and not an absence, so the split
    // settles on the hash of the empty string and the assignment is weighted.
    // A port that reads a falsy field as a missing one publishes the fallback
    // here and ships one bucket of every tenant the wrong experience.
    expect(JSON.parse(JSON.stringify(decisions))).not.toEqual(
      fixture.decisions,
    );
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

/**
 * What an engine finishes one plan into, for the plan fixture's client context.
 *
 * The two transforms below each drop one rule `resolvePlan` applies, so what
 * this answers over them is what a port that never implemented that rule
 * answers. A fixture such a port reproduces holds nothing about the rule.
 */
function finishedOver(plan: PlanFixture['plan']): unknown {
  const features = createFeatures(planFixture.config);
  return JSON.parse(
    JSON.stringify(resolvePlan(features, plan, supplied(planFixture.context))),
  );
}

/** The plan a port that reads no entry at all reads. */
const PLAN_IGNORED: PlanFixture['plan'] = {};

/** The plan a port that keeps no decision the build settled for one key reads. */
function withoutDecision(
  plan: PlanFixture['plan'],
  key: string,
): PlanFixture['plan'] {
  return Object.fromEntries(
    Object.entries(plan).map(([named, entry]) => {
      if (named !== key) return [named, entry];
      const { decision, ...rest } = entry ?? {};
      return [named, rest];
    }),
  ) as PlanFixture['plan'];
}

/**
 * The plan a port that reads a settled entry as a deferred one reads.
 *
 * Rule 1 of § 5 of `docs/specs/2026-09-23-feature-hydration.md` takes a settled
 * entry's decision whole, and rule 3 takes its enablement and buckets the split
 * again. A port carrying one branch for both reads a settled entry the way this
 * transform states it, so what it answers is what `resolvePlan` answers over
 * this output.
 */
function asDeferred(
  plan: PlanFixture['plan'],
  key: string,
  field: string,
): PlanFixture['plan'] {
  return Object.fromEntries(
    Object.entries(plan).map(([named, entry]) => {
      if (named !== key) return [named, entry];
      return [named, { ...entry, resolved: 'deferred', needs: [field] }];
    }),
  ) as PlanFixture['plan'];
}

describe('the published plan fixture', () => {
  it('finishes the plan into the decisions it publishes', () => {
    const features = createFeatures(planFixture.config);

    const decisions = resolvePlan(
      features,
      planFixture.plan,
      supplied(planFixture.context),
    );

    expect(JSON.parse(JSON.stringify(decisions))).toEqual(
      planFixture.decisions,
    );
  });

  it('carries a deferred entry the build settled a decision on', () => {
    const deferred = Object.values(planFixture.plan).filter(
      (entry) =>
        entry !== undefined &&
        entry.resolved === 'deferred' &&
        entry.decision !== undefined,
    );

    // Rule 3 of § 5 of `docs/specs/2026-09-23-feature-hydration.md`, which is
    // the case this file exists for. `planFeature` writes it for a feature
    // whose rules the build instant settled and whose split the build context
    // could not bucket, so `needs` names the bucketing field alone and the
    // decision states enablement without a variant.
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toMatchObject({
      key: 'launch-banner',
      resolved: 'deferred',
      needs: ['tenantId'],
      decision: { enabled: true, reason: 'rule-match', rule: 'launch-window' },
    });
    expect(deferred[0]?.decision).not.toHaveProperty('variant');
  });

  it('carries a settled entry whose decision holds the split the build bucketed', () => {
    const settled = Object.values(planFixture.plan).filter(
      (entry) =>
        entry !== undefined &&
        entry.resolved === true &&
        entry.decision?.assignment !== undefined,
    );

    // Rule 1 of § 5 of `docs/specs/2026-09-23-feature-hydration.md` takes a
    // settled entry's decision whole, variant included. `shipping-promo`
    // buckets on `region`, which the build context carries and the client
    // context does not, so rule 1 and rule 3 answer differently for it: rule 1
    // publishes the weighted assignment the build settled and rule 3 would
    // bucket again and reach the control as a fallback. Without an entry of
    // this shape the fixture states nothing about which branch a port runs
    // over a settled entry, because the other two settled entries declare no
    // variants and the two branches agree on every one of those.
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({
      key: 'shipping-promo',
      resolved: true,
      needs: [],
      decision: {
        enabled: true,
        variant: 'threshold',
        assignment: { source: 'weighted', by: 'region' },
      },
    });
    expect(planFixture.context).not.toHaveProperty('region');
    expect(planFixture.buildContext.region).toBe('eu-west');
  });

  it('keeps the enablement the plan settled through the client pass', () => {
    const settled = planFixture.plan['launch-banner']?.decision;
    const finished = planFixture.decisions['launch-banner'] as {
      enabled: boolean;
      reason: string;
      rule: string;
      assignment?: { source?: string; by?: string };
    };

    // Rule 3 of § 5 of `docs/specs/2026-09-23-feature-hydration.md` reads the
    // enablement off the entry and computes the variant alone. The client
    // context carries `plan` as well, so a port that re-ran the rules reaches
    // the same enablement and this case does not separate the two. What it
    // holds is the agreement between the entry and the published decisions,
    // so a fixture whose two halves no longer state one answer is refused.
    expect(settled).toMatchObject({ enabled: true, reason: 'rule-match' });
    expect(finished.enabled).toBe(settled?.enabled);
    expect(finished.reason).toBe(settled?.reason);
    expect(finished.rule).toBe(settled?.rule);
    expect(finished.assignment).toMatchObject({
      source: 'weighted',
      by: 'tenantId',
    });
  });

  it('passes the checker every holder runs before it installs', () => {
    const result = parseFeatureConfig(planFixture.config);

    // This covers the digest too. `validateConfig` reports `digest-mismatch`
    // for a document whose bytes the stated digest no longer covers, so a
    // fixture someone hand-edited without recomputing the digest fails here.
    expect(result.ok === false && result.issues).toBeFalsy();
    expect(result.ok).toBe(true);
  });

  it('carries an explicit offset on every instant it states', () => {
    const text = JSON.stringify(planFixture);

    // ECMA-262 reads a date-time string with no offset as local time, so an
    // offsetless instant here would plan one way in Stockholm and another in
    // Tokyo. Issue #284.
    expect(offsetless(text)).toEqual([]);
    expect(text).toMatch(INSTANT);
  });

  it('plans the entries it publishes, for the build context it states', () => {
    const features = createFeatures(planFixture.config);

    const planned = features.plan(supplied(planFixture.buildContext));

    // The plan is the half of this fixture no engine is handed, so a holder
    // that cannot reproduce it is trusting a hand-written file. The build
    // context carries the instant alone, which is what defers `pro-perks` on
    // `plan` and `launch-banner` on `tenantId`.
    expect(JSON.parse(JSON.stringify(planned))).toEqual(planFixture.plan);
  });

  it('names the members a holder reads, and no other', () => {
    // § 9 defines a fixture as one document, one context and the expected
    // decisions. A plan fixture adds the plan a build published and the
    // context it was planned at, because a holder that cannot reproduce the
    // plan is trusting a file nothing checks.
    expect(Object.keys(planFixture).sort()).toEqual([
      'buildContext',
      'config',
      'context',
      'decisions',
      'note',
      'plan',
    ]);
  });

  it('publishes decisions a pass that read no plan entry does not reach', () => {
    // The case this fixture exists for. A port that hands back
    // `features.resolve(context)` implements none of the three rules, and a
    // fixture it reproduces holds nothing about any of them. `preorder-badge`
    // is what separates the two: the build froze its window, the client
    // instant has passed that window, and the published decision is the one
    // the build settled.
    expect(finishedOver(PLAN_IGNORED)).not.toEqual(planFixture.decisions);
    expect(finishedOver(planFixture.plan)).toEqual(planFixture.decisions);
  });

  it('publishes a settled decision a re-decided entry does not reproduce', () => {
    const redecided = finishedOver(
      withoutDecision(planFixture.plan, 'preorder-badge'),
    ) as Record<string, { enabled: boolean; reason: string }>;

    // Rule 1, held on its own. `preorder-badge` resolved at build time and the
    // published decision is the build's. A port that re-runs its rules against
    // the client context answers off, because the window the build froze has
    // closed by the instant the client states.
    expect(redecided['preorder-badge']).toMatchObject({
      enabled: false,
      reason: 'no-rule-matched',
    });
    expect(planFixture.decisions['preorder-badge']).toMatchObject({
      enabled: true,
      reason: 'rule-match',
    });
  });

  it('publishes a settled assignment a re-bucketed entry does not reproduce', () => {
    const rebucketed = finishedOver(
      asDeferred(planFixture.plan, 'shipping-promo', 'region'),
    ) as Record<
      string,
      { variant: string; assignment: { source: string }; value: unknown }
    >;

    // Rule 1's assignment half, held on its own. The build bucketed
    // `shipping-promo` on a `region` the server resolves per request and the
    // browser never sees, and the published decision is the build's. A port
    // that runs rule 3's body over this entry -- enablement off the entry, the
    // split bucketed again -- hands the subject the control over a context
    // carrying no `region`, which flips the variant between the server tree
    // and the hydrated one.
    expect(rebucketed['shipping-promo']).toMatchObject({
      enabled: true,
      variant: 'control',
      assignment: { source: 'fallback', by: 'region' },
      value: { copy: 'Shipping from 4.90' },
    });
    expect(rebucketed['shipping-promo']?.assignment).not.toHaveProperty(
      'bucket',
    );
    expect(planFixture.decisions['shipping-promo']).toMatchObject({
      variant: 'threshold',
      assignment: { source: 'weighted', by: 'region' },
      value: { copy: 'Free shipping over 50' },
    });
  });

  it('publishes a deferred enablement a re-decided entry does not reproduce', () => {
    const redecided = finishedOver(
      withoutDecision(planFixture.plan, 'launch-banner'),
    ) as Record<string, { enabled: boolean; reason: string }>;

    // Rule 3, held on its own. The entry settled enablement and deferred the
    // split, so the client computes the assignment and reads enablement off
    // the entry. A port that re-runs the rules to get the enablement it needs
    // for the assignment answers off and ships no banner at all.
    expect(redecided['launch-banner']).toMatchObject({
      enabled: false,
      reason: 'no-rule-matched',
    });
    expect(planFixture.decisions['launch-banner']).toMatchObject({
      enabled: true,
      reason: 'rule-match',
    });
  });

  it('closes every frozen window between the build instant and the client one', () => {
    const frozen = planFixture.config.features.filter(
      (definition) => definition.freezeTimeAtBuild,
    );
    const closings = frozen.map((definition) =>
      definition.rules
        ?.flatMap((rule) => rule.when ?? [])
        .find((condition) => condition.op === 'before'),
    );
    const built = new Date(planFixture.buildContext.now).getTime();
    const rendered = new Date(planFixture.context.now).getTime();

    // Every case above rests on these inequalities, and a window widened past
    // the client instant would retire them while leaving them green.
    // `freezeTimeAtBuild` is what entitles an entry to the build's answer:
    // without it `planFeature` reads no `now` and defers the feature instead.
    expect(frozen.map((definition) => definition.key)).toEqual([
      'launch-banner',
      'preorder-badge',
    ]);
    expect(
      closings.map((condition) => {
        const closesAt = new Date(String(condition?.value)).getTime();
        return built < closesAt && rendered >= closesAt;
      }),
    ).toEqual(closings.map(() => true));
  });

  it('finishes the plan to the same decisions under any client clock', () => {
    const features = createFeatures(planFixture.config);
    const { now, ...dated } = planFixture.context;
    const onNow = [...planFixture.config.features].filter((definition) =>
      (definition.rules ?? []).some((rule) =>
        (rule.when ?? []).some((condition) => condition.field === 'now'),
      ),
    );

    const decisions = resolvePlan(features, planFixture.plan, dated);

    // What the plan buys: every feature whose answer the clock decides was
    // settled at the build instant, so the client needs no clock to finish
    // the plan. The filter is this case's own guard -- a rule on `now` added
    // to a feature that does not freeze time would make the published
    // decisions depend on the host clock, and this case would start failing
    // somewhere other than here.
    expect(now).toBeTypeOf('string');
    expect(onNow.map((definition) => definition.freezeTimeAtBuild)).toEqual(
      onNow.map(() => true),
    );
    expect(JSON.parse(JSON.stringify(decisions))).toEqual(
      planFixture.decisions,
    );
  });

  it('states the digest of the document it carries', () => {
    expect(planFixture.config.digest).toBe(configDigest(planFixture.config));
  });

  it('states a digest of this document and of no other', () => {
    const moved: FeatureConfig = {
      ...planFixture.config,
      features: [...planFixture.config.features].reverse(),
    };

    expect(configDigest(moved)).not.toBe(planFixture.config.digest);
  });
});
